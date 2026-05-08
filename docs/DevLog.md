Bisher gemacht:
- Git repo angelegt  "C:\LEO\Projekte\GitHub\truefood-scanner\App"
- Folgende befehler ausgeführt :

```pwsh
# Expo Projekt mit TypeScript Vorlage erstellen
npx create-expo-app@latest . --template blank-typescript

# Notwendige Abhängigkeiten für den MVP & v2 installieren
npx expo install expo-camera expo-barcode-scanner expo-sqlite zustand expo-router react-native-safe-area-context react-native-screens

# Testing-Umgebung aufsetzen
npm install --save-dev jest jest-expo @types/jest --legacy-peer-deps
```

- Verzeichnisse angelegt : 
```
"screens", "components", "store", "domain/analysis", "domain/rules", "infrastructure/api", "infrastructure/db", "navigation", "types" | ForEach-Object { New-Item -Path "src/$_" -ItemType Directory -Force }
```
