{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    (if pkgs ? nodejs_22 then pkgs.nodejs_22 else pkgs.nodejs)
    pkgs.git
  ];
}
