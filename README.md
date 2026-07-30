# Arena Rig

Motor de animación procedural compartido para LUDUS (gladiadores) y el proyecto MMA: poses abstractas aplicables a cualquier rig humanoide, con banco de pruebas web.

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Cada push a `main` despliega automáticamente el banco de pruebas en GitHub Pages (fuente: GitHub Actions).

## Replay MMAM

El banco incluye un modo replay del log de combate de MMAM (`?replay=1`), con dos combates de demostración: final por KO (por defecto) y final por sumisión (`&fight=sub`).
