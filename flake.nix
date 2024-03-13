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
        buildInputs = with pkgs; [
          deno
          curl
          xh
          sqlite
        ];
      };

      default = outputs.devShells.${system}.deno-dev;
    });
  };
}
