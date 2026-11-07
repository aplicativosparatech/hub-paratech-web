using System;

namespace HubParatechDesktop
{
    public static class AppConfig
    {
        public const string BasePortalUrl = "https://hub.paratechsolucoes.com.br";
        public const string SyncApiUrl = BasePortalUrl + "/api/hub/sync";
        public const string UploadXmlApiUrl = BasePortalUrl + "/api/hub/upload-xml";
        public const string ReconciliarGapsApiUrl = BasePortalUrl + "/api/hub/reconciliar-gaps";
        public const string CheckUpdateApiUrl = BasePortalUrl + "/api/hub/versoes/check";
        public const string ClientesUrl = BasePortalUrl + "/dashboard/clientes";
        public const string NfceSaidasUrl = BasePortalUrl + "/dashboard/notas-fiscais/saidas/nfce";
        public const string NfeSaidasUrl = BasePortalUrl + "/dashboard/notas-fiscais/saidas/nfe";
        public const string NfeEntradasUrl = BasePortalUrl + "/dashboard/notas-fiscais/entradas/nfe";
    }
}
