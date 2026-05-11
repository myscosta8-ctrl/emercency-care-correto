{ pkgs, ... }: {
  # Canal unstable para ter Node.js 24 (mesma versão usada no Replit)
  channel = "unstable";

  packages = [
    pkgs.nodejs_24
    pkgs.nodePackages.pnpm
  ];

  # Variáveis de ambiente não-secretas (defina os segredos no painel de Secrets do IDX)
  env = {
    NODE_ENV    = "development";
    # Porta do frontend
    PORT        = "23662";
    BASE_PATH   = "/";
    # Porta da API (usada pelo proxy do Vite)
    API_PORT    = "8080";
    # Para que o Vite ative o proxy interno (ausência de REPL_ID = fora do Replit)
    # Não defina REPL_ID aqui.
  };

  idx = {
    # Extensões recomendadas para VS Code/IDX
    extensions = [
      "esbenp.prettier-vscode"
      "dbaeumer.vscode-eslint"
      "bradlc.vscode-tailwindcss"
      "ms-vscode.vscode-typescript-next"
      "ms-vscode.vscode-json"
      "PKief.material-icon-theme"
    ];

    workspace = {
      # Executado apenas na criação do workspace (primeira vez)
      onCreate = {
        pnpm-install = "pnpm install";
      };

      # Executado a cada abertura/retomada do workspace
      onStart = {
        # Carrega .env e inicia a API; o Vite faz proxy de /api → localhost:8080
        api-server = ''
          set -a
          [ -f .env ] && source .env
          set +a
          PORT=8080 NODE_ENV=development \
          pnpm --filter @workspace/api-server run dev
        '';
      };
    };

    # Painel de preview (equivalente aos workflows do Replit)
    previews = {
      enable = true;
      previews = {
        # Frontend — o Vite já redireciona /api para a API via proxy
        web = {
          command = [
            "pnpm" "--filter" "@workspace/upa-system" "run" "dev"
          ];
          manager = "web";
          env = {
            # PORT é atribuído automaticamente pelo IDX — não sobrescrever
            BASE_PATH   = "/";
            API_PORT    = "8080";
            NODE_ENV    = "development";
          };
        };
      };
    };
  };
}
