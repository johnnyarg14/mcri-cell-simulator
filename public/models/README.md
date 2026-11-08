# Modele glTF

Pune aici fișierele `.glb` și înregistrează-le în `manifest.json`:

```json
{
  "EQ_VISION": { "file": "Statie_inspectie_vision_457.glb", "scale": 1, "position": [0, 0, 0], "rotation": [0, 0, 0] }
}
```

Cheia = id-ul obiectului din Object Tree (vezi README principal, tabelul de id-uri).
`scale: 1` înseamnă model în milimetri; pentru modele exportate în metri folosește `scale: 1000`.
