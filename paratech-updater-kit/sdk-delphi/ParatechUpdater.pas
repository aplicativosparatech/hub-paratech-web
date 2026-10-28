unit ParatechUpdater;

{==============================================================================}
{ Paratech Universal Auto-Updater SDK para Delphi / Lazarus                     }
{ Compatível com: Delphi 7, XE, 10, 11, 12 e Lazarus / FreePascal              }
{==============================================================================}

interface

uses
  Windows, SysUtils, Classes, ShellAPI;

type
  TTipoModoAtualizacao = (tmInformativo, tmAutomatico);

  TParatechUpdater = class
  public
    // Executa o atualizador autônomo ParatechUpdater.exe presente na mesma pasta do sistema
    class procedure ExecutarAtualizador(const ASistemaId, AVersaoAtual: string; AModo: TTipoModoAtualizacao = tmInformativo; const ACnpj: string = '');
    
    // Obtém o comando formatado para ser executado
    class function MontarParametros(const ASistemaId, AVersaoAtual: string; AModo: TTipoModoAtualizacao; const ACnpj: string): string;
  end;

implementation

{ TParatechUpdater }

class function TParatechUpdater.MontarParametros(const ASistemaId, AVersaoAtual: string; AModo: TTipoModoAtualizacao; const ACnpj: string): string;
var
  ModoStr: string;
begin
  if AModo = tmAutomatico then
    ModoStr := 'auto'
  else
    ModoStr := 'dialog';

  Result := Format('--app=%s --version=%s --mode=%s', [ASistemaId, AVersaoAtual, ModoStr]);
  
  if Trim(ACnpj) <> '' then
    Result := Result + Format(' --cnpj=%s', [Trim(ACnpj)]);
end;

class procedure TParatechUpdater.ExecutarAtualizador(const ASistemaId, AVersaoAtual: string; AModo: TTipoModoAtualizacao = tmInformativo; const ACnpj: string = '');
var
  ExePath, Params: string;
begin
  // Procura ParatechUpdater.exe no mesmo diretório da aplicação
  ExePath := ExtractFilePath(ParamStr(0)) + 'ParatechUpdater.exe';

  // Se não encontrar na pasta atual, procura na pasta pai ou em c:\Program Files\Paratech
  if not FileExists(ExePath) then
  begin
    ExePath := ExtractFilePath(ParamStr(0)) + '..\ParatechUpdater.exe';
    if not FileExists(ExePath) then
      ExePath := 'C:\Program Files\Paratech\ParatechUpdater.exe';
  end;

  if FileExists(ExePath) then
  begin
    Params := MontarParametros(ASistemaId, AVersaoAtual, AModo, ACnpj);
    ShellExecute(0, 'open', PChar(ExePath), PChar(Params), nil, SW_SHOWNORMAL);
  end;
end;

end.
