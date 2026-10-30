# StudyHub 🎓⚡

Eine moderne, ganzheitliche Web-Applikation für Studierende zur Organisation des Studiums, Leistungsüberwachung (ECTS/GPA) und adaptiven Prüfungsvorbereitung mit **Klausur-Readiness-Score**, **Spaced Repetition**, **Multi-User Authentifizierung**, **PWA-Unterstützung** und **KI-gestütztem Klausurtrainer**.

---

## 🌟 Hauptfunktionen

### 1. Globales Header-Dashboard (Noten- & ECTS-Tracker)
- **Gesamtfortschritt:** Aktuelle ECTS vs. konfigurierbare Ziel-ECTS (Bachelor 180 ECTS, Master 120 ECTS oder individuell) mit visualisiertem Fortschrittsbalken.
- **Aktueller Notenschnitt (GPA):** Nach ECTS-Punkten exakt gewichteter Notendurchschnitt aller als „Bestanden“ markierten Fächer.
- **Dark/Light-Mode & Einstellungen:** Schnelles Umschalten zwischen Themes und KI-Modellen.

### 2. Dynamische Semester-Hierarchie & Modul-Übersicht
- **Beliebig viele Semester:** Horizontale Tab-Leiste, Semester anlegen (+ Schnellauswahl für WS/SS), umbenennen, löschen oder als aktiv festlegen.
- **Modul-Karten:**
  - ECTS-Punkte & Modulkürzel.
  - **Prüfungs-Countdown:** "Noch X Tage" mit visueller Dringlichkeits-Warnung.
  - **Klausur-Readiness-Score:** 3-Zonen-Reifebalken (Rot < 50%, Gelb 50–79%, Grün ≥ 80% = prüfungsbereit).
  - **Tagesziel:** Visualisierter Countdown-Lernplan (`Fragen / Tage = Tagesziel`).
  - **Klausuraufbau-Kommentar:** Schnelle Vorschau der Dozentenhinweise auf der Karte.

### 3. Klausuren-Kalender mit automatischer Modulzuordnung 📅
- **Monats- und Timeline-Ansicht:** Visualisiert alle Prüfungen des Semesters inklusive Countdowns und Uhrzeiten.
- **Smart Auto-Match:** Bei der Termineingabe genügt die Eingabe eines Schlagworts oder Modulkürzels (z. B. *"Software"* oder *"INF-201"*), und das System ordnet den Termin automatisch dem passenden Fach zu.
- **Klausurdetails erfassen:** Prüfungsdatum, Uhrzeit, Raum/Ort und Klausuraufbau.

### 4. Fach-Detailansicht (3 Tabs) & Klausuraufbau-Kommentar
- **Klausuraufbau & Dozentenhinweise (KI-relevant):**
  - Kommentarfeld: Wie die Klausur aufgebaut sein wird (z. B. *"90 Min, 30% Multiple Choice, 70% Freitext, Fokus auf CQRS, 1 DIN-A4-Spickzettel erlaubt"*).
  - Steuert die KI-Klausursimulation und Schwerpunktsetzung.
- **Tab 1: Dokumenten- & Altklausuren-Hub**
  - Upload für Skripte, Vorlesungsfolien und Altklausuren.
  - Checkbox **"Als Altklausur kennzeichnen"**: Weist die KI an, den Dozenten-Stil, die Fragetiefe und Terminologie zu adaptieren.
  - Sofortige RAG-Indizierung mit Quellenzitaten (z. B. *"Vorlesung_03.pdf, Folie 12"*).
- **Tab 2: Klausurtrainer & Schwachstellen-Radar (Herzstück)**
  - **Prüfungsreife-Header:** Großer Fahrschul-Balken & Countdown-Tageszielring.
  - **Spaced-Repetition-Box:** Heute fällige Wiederholungsfragen nach wissenschaftlicher Vergessenskurve (1 Tag → 3 Tage → 7 Tage → 14 Tage → Gemeistert; bei Fehler Rückfall auf Tag 1).
  - **"Hier solltest du dich vertiefen":** Zeigt die 3 schwächsten Themengebiete mit:
    - **"Zusammenfassung generieren":** KI-Spickzettel aus den hinterlegten Folien.
    - **"Lücke schließen":** Sofortiges 5-Fragen-Fokustraining exakt zu dieser Lücke.
  - **Interaktiver Klausurtrainer:** Auswahl aus Single Choice, Multiple Choice, Freitext-Aufgaben mit KI-Bewertung oder gemischter Klausursimulation.
- **Tab 3: Noten- & Modulabschluss**
  - Noteneingabe (1.0 bis 5.0) und Checkbox "Modul bestanden".
  - Aktualisiert den Gesamtschnitt und ECTS-Fortschritt im Header sofort reaktiv.

---

## 🛠 Tech-Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, Canvas-Confetti.
- **Backend & DB:** SQLite mit Prisma ORM (`prisma/schema.prisma`).
- **KI & RAG:** RAG-Vektorsuch-Pipeline & semantische Freitext-Bewertungs-Engine (unterstützt direkt OpenAI `gpt-4o`, Anthropic `claude-3-5-sonnet` oder die integrierte lokale RAG-Engine ohne API-Key-Zwang!).

---

## 🚀 Schnellanleitung zum Starten

### 1. Entwicklungsserver starten
```bash
npm run dev
```
Oder Produktions-Build starten:
```bash
npm run build
npm start
```

Die Applikation läuft standardmäßig auf [http://localhost:3000](http://localhost:3000).

### 2. Demodaten zurücksetzen oder neu laden
Du kannst jederzeit entweder im UI über die **Einstellungen (Zahnrad)** auf "Demodaten zurücksetzen" klicken, oder per CLI ausführen:
```bash
npm run seed
```
Dies lädt realistische Module (u. a. *Software Engineering & Architektur*, *Datenbanksysteme II*, Vorlesungsfolien, Altklausuren und Fragenkatalog).
