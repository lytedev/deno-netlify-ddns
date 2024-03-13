{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = {
    self,
    nixpkgs,
  }: let
    inherit (self) outputs;
    supportedSystems = ["x86_64-linux"];
    forEachSupportedSystem = nixpkgs.lib.genAttrs supportedSystems;
  in {
    devShells = forEachSupportedSystem (system: let
      pkgs = import nixpkgs {inherit system;};
    in {
      deno-dev = pkgs.mkShell {
        shellHook = ''
          deno install -Arf https://deno.land/x/deploy/deployctl.ts
          export PATH="$HOME/.deno/bin:$PATH"
        '';

        buildInputs = with pkgs; [
          deno
          cue
          sops
          curl
          xh
          sqlite
        ];
      };

      default = outputs.devShells.${system}.deno-dev;
    });
  };
}
