import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../data/mei_database.dart';
import '../data/app_version.dart';

class ParatechUpdateInfo {
  final bool temAtualizacao;
  final String versaoAtual;
  final int buildNumberAtual;
  final String versaoMaisRecente;
  final int buildNumberMaisRecente;
  final bool obrigatoria;
  final String politicaEfetiva; // 'automatica' | 'informativa'
  final String changelog;
  final String urlDownload;
  final String? sha256;
  final int? tamanhoBytes;

  const ParatechUpdateInfo({
    this.temAtualizacao = false,
    this.versaoAtual = '1.0.0',
    this.buildNumberAtual = 1,
    this.versaoMaisRecente = '1.0.0',
    this.buildNumberMaisRecente = 1,
    this.obrigatoria = false,
    this.politicaEfetiva = 'informativa',
    this.changelog = '',
    this.urlDownload = '',
    this.sha256,
    this.tamanhoBytes,
  });

  factory ParatechUpdateInfo.fromJson(Map<String, dynamic> json) {
    return ParatechUpdateInfo(
      temAtualizacao: json['tem_atualizacao'] == true,
      versaoAtual: json['versao_atual']?.toString() ?? '1.0.0',
      buildNumberAtual: int.tryParse(json['build_number_atual']?.toString() ?? '1') ?? 1,
      versaoMaisRecente: json['versao_mais_recente']?.toString() ?? '1.0.0',
      buildNumberMaisRecente: int.tryParse(json['build_number_mais_recente']?.toString() ?? '1') ?? 1,
      obrigatoria: json['obrigatoria'] == true,
      politicaEfetiva: json['politica_efetiva']?.toString() ?? 'informativa',
      changelog: json['changelog']?.toString() ?? '',
      urlDownload: json['url_download']?.toString() ?? '',
      sha256: json['sha256']?.toString(),
      tamanhoBytes: int.tryParse(json['tamanho_bytes']?.toString() ?? '0'),
    );
  }
}

class ParatechUpdaterService extends ChangeNotifier {
  static final ParatechUpdaterService _instance = ParatechUpdaterService._internal();
  factory ParatechUpdaterService() => _instance;
  ParatechUpdaterService._internal();

  static const String _defaultApiUrl = 'https://hub-paratech-web.vercel.app/api/hub/versoes/check';

  MeiDatabase? _database;
  String _sistemaId = 'mei_simples';
  String _versaoAtual = '1.0.0';
  int _buildNumberAtual = 1;

  ParatechUpdateInfo? _info;
  ParatechUpdateInfo? get info => _info;

  bool _isChecking = false;
  bool get isChecking => _isChecking;

  bool _isDownloading = false;
  bool get isDownloading => _isDownloading;

  double _downloadProgress = 0.0;
  double get downloadProgress => _downloadProgress;

  String _statusMessage = '';
  String get statusMessage => _statusMessage;

  Timer? _periodicTimer;

  // Inicializa o serviço com o banco local e metadados da aplicação
  void initialize({
    required MeiDatabase database,
    String sistemaId = 'mei_simples',
    String? versaoAtual,
    int? buildNumberAtual,
    BuildContext? context,
  }) {
    _database = database;
    _sistemaId = sistemaId;
    _versaoAtual = versaoAtual ?? AppVersion.version;
    _buildNumberAtual = buildNumberAtual ?? AppVersion.buildNumber;

    if (database.db.path == ':memory:') return;

    // Checagem inicial após 5 segundos da inicialização do app
    Future.delayed(const Duration(seconds: 5), () {
      verificarAtualizacoes(context: context);
    });

    // Checagem periódica a cada 4 horas
    _periodicTimer?.cancel();
    _periodicTimer = Timer.periodic(const Duration(hours: 4), (_) {
      verificarAtualizacoes(context: context);
    });
  }

  // Obter modo local configurado ('automatica' ou 'informativa')
  Future<String> getModoAtualizacao() async {
    if (_database == null) return 'informativa';
    final val = await _database!.getSetting('paratech_updater_mode');
    return val ?? 'informativa';
  }

  // Salvar modo local configurado
  Future<void> setModoAtualizacao(String modo) async {
    if (_database == null) return;
    await _database!.setSetting('paratech_updater_mode', modo);
    notifyListeners();
  }

  // Verifica se há novas versões
  Future<ParatechUpdateInfo?> verificarAtualizacoes({
    BuildContext? context,
    bool exibirAvisoSeAtualizado = false,
  }) async {
    if (_isChecking) return _info;

    _isChecking = true;
    _statusMessage = 'Verificando atualizações no Hub...';
    notifyListeners();

    try {
      final modoLocal = await getModoAtualizacao();
      String cnpj = '';
      if (_database != null) {
        cnpj = (await _database!.getSetting('issuer_cnpj') ?? '').replaceAll(RegExp(r'\D'), '');
      }

      String pcName = 'Estacao Principal';
      try {
        if (!kIsWeb) {
          pcName = Platform.localHostname;
        }
      } catch (_) {}

      String hubToken = '';
      try {
        const storage = FlutterSecureStorage();
        final t = await storage.read(key: 'mei_simples.hub.token');
        if (t != null) hubToken = t;
      } catch (_) {}

      final uri = Uri.parse(_defaultApiUrl).replace(queryParameters: {
        'sistema_id': _sistemaId,
        'versao_atual': _versaoAtual,
        'build_number': _buildNumberAtual.toString(),
        'cnpj': cnpj,
        'token': hubToken,
        'nome_computador': pcName,
        'politica': modoLocal,
        'so': Platform.operatingSystem,
      });

      final response = await http.get(uri).timeout(const Duration(seconds: 12));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        _info = ParatechUpdateInfo.fromJson(data);

        if (_info!.temAtualizacao) {
          // Se for obrigatória ou automática, executa download direto
          if (_info!.obrigatoria || _info!.politicaEfetiva == 'automatica' || modoLocal == 'automatica') {
            await baixarEInstalarSilenciosamente();
          } else if (context != null && context.mounted) {
            // Se for informativa, exibe diálogo para o cliente
            _exibirDialogoAtualizacao(context, _info!);
          }
        } else if (exibirAvisoSeAtualizado && context != null && context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Você já está utilizando a versão mais recente ($_versaoAtual).'),
              backgroundColor: Colors.teal.shade800,
            ),
          );
        }
      }
    } catch (e) {
      debugPrint('Aviso: Erro ao checar atualizações no Hub: $e');
    } finally {
      _isChecking = false;
      notifyListeners();
    }

    return _info;
  }

  // Baixa o instalador e executa
  Future<void> baixarEInstalarSilenciosamente() async {
    if (_info == null || _info!.urlDownload.isEmpty || _isDownloading) return;

    if (!Platform.isWindows) {
      debugPrint('Atualização automática suportada apenas no Windows.');
      return;
    }

    _isDownloading = true;
    _downloadProgress = 0.0;
    _statusMessage = 'Baixando atualização...';
    notifyListeners();

    try {
      final client = http.Client();
      final request = http.Request('GET', Uri.parse(_info!.urlDownload));
      final response = await client.send(request);

      final totalBytes = response.contentLength ?? _info!.tamanhoBytes ?? 0;
      int bytesRecebidos = 0;

      final tempDir = Directory.systemTemp;
      final updateFolder = Directory('${tempDir.path}\\ParatechUpdates');
      if (!updateFolder.existsSync()) {
        updateFolder.createSync(recursive: true);
      }

      final fileName = 'instalador_${_sistemaId}_v${_info!.versaoMaisRecente}.exe';
      final file = File('${updateFolder.path}\\$fileName');
      final sink = file.openWrite();

      await response.stream.listen((chunk) {
        bytesRecebidos += chunk.length;
        sink.add(chunk);
        if (totalBytes > 0) {
          _downloadProgress = bytesRecebidos / totalBytes;
          notifyListeners();
        }
      }).asFuture();

      await sink.flush();
      await sink.close();

      _statusMessage = 'Iniciando instalador...';
      notifyListeners();

      // Executa instalador em modo silencioso
      // Parâmetros do Inno Setup:
      // /SILENT: Instalação silenciosa sem assistente
      // /SUPPRESSMSGBOXES: Não exibe caixas de alerta
      // /FORCECLOSEAPPLICATIONS: Fecha o processo do app automaticamente
      // /RESTARTAPPLICATIONS: Reabre o app assim que terminar a instalação
      await Process.start(file.path, [
        '/SILENT',
        '/SUPPRESSMSGBOXES',
        '/FORCECLOSEAPPLICATIONS',
        '/RESTARTAPPLICATIONS',
      ], mode: ProcessStartMode.detached);

      // Fecha o app graciosamente para permitir a substituição dos binários
      await Future.delayed(const Duration(milliseconds: 1500));
      exit(0);

    } catch (e) {
      debugPrint('Erro no download/instalação da atualização: $e');
      _statusMessage = 'Erro no download da atualização: $e';
    } finally {
      _isDownloading = false;
      notifyListeners();
    }
  }

  void exibirDialogoManual(BuildContext context) {
    if (_info != null && _info!.temAtualizacao) {
      _exibirDialogoAtualizacao(context, _info!);
    } else {
      verificarAtualizacoes(context: context, exibirAvisoSeAtualizado: true);
    }
  }

  void _exibirDialogoAtualizacao(BuildContext context, ParatechUpdateInfo info) {
    showDialog(
      context: context,
      barrierDismissible: !info.obrigatoria,
      builder: (ctx) {
        return _UpdateModalDialog(info: info, updater: this);
      },
    );
  }
}

class _UpdateModalDialog extends StatefulWidget {
  final ParatechUpdateInfo info;
  final ParatechUpdaterService updater;

  const _UpdateModalDialog({required this.info, required this.updater});

  @override
  State<_UpdateModalDialog> createState() => _UpdateModalDialogState();
}

class _UpdateModalDialogState extends State<_UpdateModalDialog> {
  bool _baixando = false;

  @override
  Widget build(BuildContext context) {
    final info = widget.info;

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.rocket_launch_rounded, color: Color(0xFF059669), size: 26),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Nova Versão Disponível!',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                Text(
                  'Versão ${info.versaoMaisRecente} (Build #${info.buildNumberMaisRecente})',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
        ],
      ),
      content: SizedBox(
        width: 480,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (info.obrigatoria)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  border: Border.all(color: Colors.amber.shade300),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning_amber_rounded, color: Colors.amber.shade900, size: 20),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Atualização crítica obrigatória da SEFAZ / Sistema.',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF78350F)),
                      ),
                    ),
                  ],
                ),
              ),

            const Text(
              'O que há de novo:',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
            const SizedBox(height: 6),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 180),
                child: SingleChildScrollView(
                  child: Text(
                    info.changelog.isNotEmpty
                        ? info.changelog
                        : '• Melhorias gerais de estabilidade e desempenho.',
                    style: const TextStyle(fontSize: 12, height: 1.4),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),

            if (_baixando) ...[
              const Text(
                'Baixando e preparando atualização...',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF059669)),
              ),
              const SizedBox(height: 8),
              ListenableBuilder(
                listenable: widget.updater,
                builder: (context, _) {
                  return Column(
                    children: [
                      LinearProgressIndicator(
                        value: widget.updater.downloadProgress > 0 ? widget.updater.downloadProgress : null,
                        backgroundColor: Colors.grey.shade200,
                        color: const Color(0xFF10B981),
                        borderRadius: BorderRadius.circular(8),
                        minHeight: 8,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${(widget.updater.downloadProgress * 100).toInt()}% concluído',
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                      ),
                    ],
                  );
                },
              ),
            ],
          ],
        ),
      ),
      actionsPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      actions: [
        if (!info.obrigatoria && !_baixando)
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('Lembrar Mais Tarde', style: TextStyle(color: Colors.grey.shade700)),
          ),
        if (!_baixando)
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF059669),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () {
              setState(() {
                _baixando = true;
              });
              widget.updater.baixarEInstalarSilenciosamente();
            },
            icon: const Icon(Icons.download_rounded, size: 18),
            label: const Text('Atualizar Agora', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
      ],
    );
  }
}
