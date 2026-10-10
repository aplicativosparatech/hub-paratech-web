namespace HubParatechDesktop;

static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        // Em vez de rodar um Form1, rodamos nosso TrayContext que fica escondido
        Application.Run(new TrayContext());
    }
}