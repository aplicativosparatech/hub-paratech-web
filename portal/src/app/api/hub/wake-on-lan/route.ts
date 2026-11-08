import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import dgram from 'dgram'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

/**
 * Envia o Magic Packet UDP (Wake-on-LAN)
 */
function sendMagicPacket(macAddress: string, broadcastIp = '255.255.255.255', port = 9): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanMac = macAddress.replace(/[^0-9a-fA-F]/g, '')
    if (cleanMac.length !== 12) {
      return reject(new Error('MAC Address inválido. Formato esperado: AA:BB:CC:DD:EE:FF'))
    }

    const macBytes = Buffer.from(cleanMac, 'hex')
    const magicPacket = Buffer.alloc(102)
    magicPacket.fill(0xff, 0, 6)
    for (let i = 0; i < 16; i++) {
      macBytes.copy(magicPacket, 6 + i * 6)
    }

    const client = dgram.createSocket('udp4')
    client.bind(() => {
      try {
        client.setBroadcast(true)
        client.send(magicPacket, 0, magicPacket.length, port, broadcastIp, (err) => {
          try { client.close() } catch {}
          if (err) reject(err)
          else resolve()
        })
      } catch (err) {
        try { client.close() } catch {}
        reject(err)
      }
    })
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cliente_id, broadcast_ip = '255.255.255.255', port = 9 } = body
    let mac_address = body.mac_address

    if (!cliente_id && !mac_address) {
      return NextResponse.json({ error: 'cliente_id ou mac_address é obrigatório.' }, { status: 400 })
    }

    // Se não passou o MAC diretamente, busca o MAC registrado nas configurações do Hub
    if (!mac_address && cliente_id) {
      const { data: config } = await supabase
        .from('configuracoes_hub')
        .select('mac_address, ip_local')
        .eq('cliente_id', cliente_id)
        .maybeSingle()

      if (config?.mac_address) {
        mac_address = config.mac_address
      }
    }

    if (!mac_address) {
      return NextResponse.json({ 
        error: 'MAC Address não informado e não encontrado nas configurações do Hub deste cliente. O Hub precisa estar atualizado e ter enviado ao menos um pulso para registrar o MAC Address.' 
      }, { status: 400 })
    }

    // 1. Dispara o pacote UDP Wake-on-LAN diretamente do servidor
    let serverSent = false
    let serverError = ''
    try {
      await sendMagicPacket(mac_address, broadcast_ip, port)
      serverSent = true
    } catch (e: any) {
      serverError = e.message
      console.warn('Disparo direto UDP de Wake-on-LAN pelo servidor falhou (normal em VPC/Cloud isolada):', e.message)
    }

    // 2. Registra o comando de Wake-on-LAN em configuracoes_hub para que qualquer nó / Hub na mesma rede execute o disparo local
    if (cliente_id) {
      await supabase
        .from('configuracoes_hub')
        .update({
          comando_remoto: `acordar_pc:${mac_address}`,
          comando_remoto_em: new Date().toISOString()
        })
        .eq('cliente_id', cliente_id)
    }

    return NextResponse.json({
      success: true,
      message: `Pacote de Wake-on-LAN (Acordar PC) disparado para o MAC ${mac_address}!`,
      mac_address,
      server_broadcast: serverSent,
      detalhes: serverSent ? 'Pacote mágico UDP transmitido com sucesso.' : serverError
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
