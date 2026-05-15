{ pkgs, ... }: {
  channel = "unstable";

  packages = [
    pkgs.nodejs_24
    pkgs.nodePackages.pnpm
  ];

  env = {
    NODE_ENV = "development";
    API_PORT = "8080";
  };

  idx = {
    extensions = [
      "esbenp.prettier-vscode"
      "dbaeumer.vscode-eslint"
      "bradlc.vscode-tailwindcss"
      "ms-vscode.vscode-typescript-next"
      "ms-vscode.vscode-json"
      "PKief.material-icon-theme"
    ];

    workspace = {
      # Executado apenas na primeira criação do workspace
      onCreate = {
        pnpm-install = "pnpm install";
      };

      # Executado a cada abertura do workspace
      onStart = {
        # Mata qualquer API antiga, carrega .env e inicia a API
        api-server = ''
          pkill -f "node.*dist/index.mjs" 2>/dev/null || true
          sleep 1
          set -a
          [ -f .env ] && source .env
          set +a
          PORT=8080 NODE_ENV=development \
          pnpm --filter @workspace/api-server run dev
        '';
      };
    };

    previews = {
      enable = true;
      previews = {
        # Frontend — mata processo antigo na porta antes de iniciar
        web = {
          command = [
            "sh" "-c"
            ''
              lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true
              sleep 1
              PORT=$PORT BASE_PATH=/ API_PORT=8080 NODE_ENV=development \
              pnpm --filter @workspace/upa-system run dev
            ''
          ];
          manager = "web";
        };
      };
    };
  };
}
