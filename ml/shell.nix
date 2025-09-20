{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    (python3.withPackages (ps: with ps; [
      fastapi
      uvicorn
      python-multipart
      pillow
      torch
      torchvision
      monai
      nibabel
      numpy
      pydicom
      simpleitk
    ]))
  ];

  shellHook = ''
    export PYTHONPATH="$PWD/backend"
  '';
}
