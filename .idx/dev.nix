{ pkgs, ... }: {
  channel = "unstable";

  packages = [
    pkgs.nodejs_24
    pkgs.nodePackages.pnpm
  ];

  env = {
    NODE_ENV = "development";
    API_PORT = "8080";
    BASE_PATH = "/";
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
      onCreate = {
        pnpm-install = "pnpm install";
      };

      onStart = {
        api-server = ''
          pkill -f "node.*dist/index.mjs" 2>/dev/null || true
          sleep 1
          PORT=8080 NODE_ENV=development pnpm --filter @workspace/api-server run dev
        '';
      };
    };

    previews = {
      enable = true;
      previews = {
        web = {
          command = [
            "sh" "-c"
            "export PORT=\${PORT:-5173}; BASE_PATH=/ API_PORT=8080 NODE_ENV=development pnpm --filter @workspace/upa-system run dev"
          ];
          manager = "web";
        };
      };
    };
  };
}
