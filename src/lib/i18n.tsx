"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "de" | "en";

export interface Translations {
  appName: string;
  appSubtitle: string;
  kiBadge: string;
  ectsProgress: string;
  gpaTracker: string;
  calendar: string;
  settings: string;
  semesterOverview: string;
  addSemester: string;
  semester: string;
  semesters: string;
  activeSemester: string;
  modulesInSemester: string;
  filterAll: string;
  filterInProgress: string;
  filterCompleted: string;
  addModule: string;
  noModulesFound: string;
  noModulesHint: string;
  firstModuleBtn: string;
  examReadiness: string;
  dailyGoal: string;
  dueQuestions: string;
  examToday: string;
  daysRemaining: string;
  noExamDate: string;
  documents: string;
  examTrainer: string;
  openTrainer: string;
  passed: string;
  inProgress: string;
  planned: string;
  failed: string;
  grade: string;

  // Shared actions
  cancel: string;
  save: string;
  saving: string;
  delete: string;
  close: string;
  edit: string;
  today: string;
  month: string;
  list: string;
  back: string;

  // ECTS Calculator modal
  ectsCalculatorTitle: string;
  ectsCalculatorSubtitle: string;
  totalCollected: string;
  targetEcts: string;
  avgEctsPerSemester: string;
  semestersCount: string;
  standardComparison: string;
  estimatedSemestersLeft: string;
  semesterBreakdownTitle: string;
  modulesCompleted: string;
  noModulesInSemester: string;
  simulationTitle: string;
  simulationPace: string;
  simulationTarget: string;

  // Settings modal
  settingsTitle: string;
  settingsTargetEctsLabel: string;
  settingsCustom: string;
  settingsAiModeLabel: string;
  settingsLocalTitle: string;
  settingsLocalNoKey: string;
  settingsLocalDesc: string;
  settingsOpenAiDesc: string;
  settingsAnthropicDesc: string;
  settingsApiKeyLabel: string;
  settingsApiKeyHint: string;
  settingsResetDemoTitle: string;
  settingsResetDemoDesc: string;
  settingsResetDemoBtn: string;
  settingsResetDemoLoaded: string;

  // Semester Modals
  setAsActive: string;
  rename: string;
  deleteSemester: string;
  addSemesterTitle: string;
  addSemesterDesc: string;
  quickPresetsLabel: string;
  semesterNameLabel: string;
  semesterNamePlaceholder: string;
  markAsActiveCheckbox: string;
  creatingSemester: string;
  saveSemesterBtn: string;
  editSemesterTitle: string;
  editSemesterNameLabel: string;
  savingChanges: string;

  // Add Module Modal
  addModuleTitle: string;
  addModuleDesc: string;
  moduleNameLabel: string;
  moduleNamePlaceholder: string;
  moduleCodeLabel: string;
  moduleCodePlaceholder: string;
  ectsLabel: string;
  examDateLabel: string;
  examTimeLabel: string;
  examTimePlaceholder: string;
  examLocationLabel: string;
  examLocationPlaceholder: string;
  examStructureLabel: string;
  aiRelevantBadge: string;
  examStructurePlaceholder: string;
  statusLabel: string;
  statusInProgress: string;
  statusPlanned: string;
  statusCompleted: string;
  createModuleBtn: string;

  // Calendar & Exam Modal
  calendarTitle: string;
  calendarSubtitle: string;
  addExamDateBtn: string;
  addExamModalTitle: string;
  addExamModalDesc: string;
  selectModuleOrMatchLabel: string;
  smartAutoMatchBadge: string;
  searchModulePlaceholder: string;
  autoMatchedBadge: string;
  examDateRequiredLabel: string;
  saveAndAssignExamBtn: string;
  examListNoExams: string;
  daysUntilExam: string;
  locationPrefix: string;
  timePrefix: string;

  // Detail View Tabs
  tab1Name: string;
  tab2Name: string;
  tab3Name: string;
  weaknessRadarTitle: string;
  weaknessRadarSubtitle: string;
  generateSummaryBtn: string;
  closeGapBtn: string;
  startTrainingTitle: string;
  startTrainingSubtitle: string;
  singleChoiceTitle: string;
  singleChoiceSubtitle: string;
  multipleChoiceTitle: string;
  multipleChoiceSubtitle: string;
  freeTextTitle: string;
  freeTextSubtitle: string;
  simulationTitleBtn: string;
  simulationSubtitleBtn: string;
  examNotesTitle: string;
  editExamNotesBtn: string;

  // Module Detail Page - Tab 1 (Documents)
  uploadDocTitle: string;
  uploadDocNameLabel: string;
  uploadDocNamePlaceholder: string;
  categoryLabel: string;
  catSlides: string;
  catExercises: string;
  catLiterature: string;
  markAsPastExam: string;
  pastExamHint: string;
  docTextContentLabel: string;
  docTextContentPlaceholder: string;
  uploadAndIndexBtn: string;
  uploadingAndIndexing: string;
  storedDocsTitle: string;
  ragPipelineActive: string;
  noDocsUploaded: string;
  noDocsHint: string;
  ragSnippetModalTitle: string;
  pastExamBadge: string;
  indexedBadge: string;

  // Module Detail Page - Tab 2 (Exam Structure Modal)
  editExamDetailsModalTitle: string;
  editExamDetailsModalDesc: string;
  examCommentLabel: string;
  examCommentHint: string;
  quickSnippetsLabel: string;
  saveExamChangesBtn: string;

  // Module Detail Page - Tab 3 (Grades)
  gradesCompletionTitle: string;
  enterGradeLabel: string;
  markCompletedCheckboxTitle: string;
  markCompletedCheckboxDesc: string;
  gradeSavedToast: string;
  saveGradeAndCompletionBtn: string;

  // Exam Session Modal (Trainer)
  questionOf: string;
  chooseSingleAnswer: string;
  chooseMultiAnswers: string;
  yourAnswerFreeText: string;
  freeTextPlaceholder: string;
  submitAndEvaluateBtn: string;
  evaluatingAi: string;
  evalHeader: string;
  scoreAwarded: string;
  identifiedKeywords: string;
  missingConcepts: string;
  slideCitation: string;
  nextQuestionBtn: string;
  sessionFinishedTitle: string;
  sessionScorePrefix: string;
  greatPerformance: string;
  needsPractice: string;
  practiceAgainBtn: string;
  finishSessionBtn: string;

  // Topic Summary Modal
  aiCheatSheetTitle: string;
  aiCheatSheetSubtitle: string;
  coreConceptsTitle: string;
  examTipsTitle: string;
  copyTextBtn: string;
  copiedBtn: string;
  closeGapNowBtn: string;
}

export const translations: Record<Language, Translations> = {
  de: {
    appName: "StudyHub",
    appSubtitle: "Intelligenter Studien- & Klausurmanager",
    kiBadge: "KI 2.0",
    ectsProgress: "ECTS-Fortschritt",
    gpaTracker: "Notenschnitt (GPA)",
    calendar: "Kalender",
    settings: "Einstellungen",
    semesterOverview: "Semester-Übersicht",
    addSemester: "Semester hinzufügen",
    semester: "Semester",
    semesters: "Semester",
    activeSemester: "Aktives Semester",
    modulesInSemester: "Module in diesem Semester hinterlegt",
    filterAll: "Alle",
    filterInProgress: "In Arbeit",
    filterCompleted: "Bestanden",
    addModule: "Neues Fach anlegen",
    noModulesFound: "Keine Module gefunden",
    noModulesHint: "Für dieses Semester wurden noch keine Fächer angelegt. Starte jetzt mit deinem ersten Fach!",
    firstModuleBtn: "Erstes Fach anlegen",
    examReadiness: "Klausur-Readiness-Score",
    dailyGoal: "Tagesziel",
    dueQuestions: "fällig",
    examToday: "Klausur HEUTE!",
    daysRemaining: "Noch {n} Tage",
    noExamDate: "Kein Prüfungstermin",
    documents: "Unterlagen",
    examTrainer: "Klausurtrainer",
    openTrainer: "Klausurtrainer öffnen",
    passed: "Bestanden",
    inProgress: "In Vorbereitung",
    planned: "Geplant",
    failed: "Nicht bestanden",
    grade: "Note",

    // Shared actions
    cancel: "Abbrechen",
    save: "Speichern",
    saving: "Wird gespeichert...",
    delete: "Löschen",
    close: "Schließen",
    edit: "Bearbeiten",
    today: "Heute",
    month: "Monat",
    list: "Liste",
    back: "Zurück",

    // ECTS Calculator modal
    ectsCalculatorTitle: "ECTS Rechner & Semester-Leistungsanalyse",
    ectsCalculatorSubtitle: "Übersicht aller erbrachten Studienleistungen, Semester-Credits und Durchschnittsberechnung",
    totalCollected: "Erreichte ECTS gesamt",
    targetEcts: "Ziel-ECTS",
    avgEctsPerSemester: "Ø ECTS je Semester",
    semestersCount: "Erfasste Semester",
    standardComparison: "Richtwert Regelstudienzeit",
    estimatedSemestersLeft: "Voraussichtlich verbleibend",
    semesterBreakdownTitle: "Semester-für-Semester Leistungsübersicht",
    modulesCompleted: "Module abgeschlossen",
    noModulesInSemester: "Noch keine abgeschlossenen Leistungen in diesem Semester.",
    simulationTitle: "Abschluss-Planer & ECTS-Simulation",
    simulationPace: "Geplante ECTS pro Semester:",
    simulationTarget: "Voraussichtlicher Abschluss in:",

    // Settings modal
    settingsTitle: "Einstellungen & KI-Modell",
    settingsTargetEctsLabel: "Ziel-ECTS für Abschluss",
    settingsCustom: "Benutzerdefiniert:",
    settingsAiModeLabel: "KI-Modus für Klausurbewertung",
    settingsLocalTitle: "Integrierte RAG-Semantic-Engine (Standard)",
    settingsLocalNoKey: "Kein Key nötig",
    settingsLocalDesc: "Bewertet Freitexte sofort lokal anhand der Vorlesungsauszüge & Altklausuren.",
    settingsOpenAiDesc: "Modernste LLM-Analyse und differenzierte Freitext-Punktevergabe.",
    settingsAnthropicDesc: "Hervorragendes akademisches Urteilsvermögen und Begründung.",
    settingsApiKeyLabel: "API-Schlüssel für",
    settingsApiKeyHint: "Wird nur lokal in deinem Browser gespeichert.",
    settingsResetDemoTitle: "Demodaten neu aufsetzen",
    settingsResetDemoDesc: "Lädt Beispielsemester, Software Engineering & DBS II neu.",
    settingsResetDemoBtn: "Zurücksetzen",
    settingsResetDemoLoaded: "Geladen!",

    // Semester Modals
    setAsActive: "Als aktuell setzen",
    rename: "Umbenennen",
    deleteSemester: "Semester löschen",
    addSemesterTitle: "Neues Semester anlegen",
    addSemesterDesc: "Wähle eine Vorlage oder gib eine individuelle Bezeichnung ein.",
    quickPresetsLabel: "Schnellauswahl:",
    semesterNameLabel: "Name des Semesters",
    semesterNamePlaceholder: "z. B. Sommersemester 2027",
    markAsActiveCheckbox: "Als aktuell laufendes Semester markieren",
    creatingSemester: "Wird angelegt...",
    saveSemesterBtn: "Semester speichern",
    editSemesterTitle: "Semester bearbeiten",
    editSemesterNameLabel: "Name",
    savingChanges: "Änderung speichern",

    // Add Module Modal
    addModuleTitle: "Neues Fach / Modul anlegen",
    addModuleDesc: "Trage die Basisdaten und den Klausurtermin ein.",
    moduleNameLabel: "Modulname *",
    moduleNamePlaceholder: "z. B. Software Engineering & Architektur",
    moduleCodeLabel: "Modulkürzel (optional)",
    moduleCodePlaceholder: "z. B. INF-201",
    ectsLabel: "ECTS Punkte *",
    examDateLabel: "Prüfungstermin (für Countdown-Lernplan)",
    examTimeLabel: "Uhrzeit (optional)",
    examTimePlaceholder: "z. B. 10:00 – 12:00",
    examLocationLabel: "Raum / Ort (optional)",
    examLocationPlaceholder: "z. B. Hörsaal 1A",
    examStructureLabel: "Klausuraufbau & Dozentenhinweise",
    aiRelevantBadge: "✨ KI-Relevant",
    examStructurePlaceholder: "z. B. 90 Min, 30% Multiple Choice, 70% Freitext. Dozent legt Wert auf exakte Definitionen. 1 DIN-A4 Spickzettel erlaubt.",
    statusLabel: "Status",
    statusInProgress: "In Vorbereitung",
    statusPlanned: "Geplant",
    statusCompleted: "Bereits Bestanden",
    createModuleBtn: "Fach anlegen",

    // Calendar & Exam Modal
    calendarTitle: "Klausuren-Kalender & Fristenplaner",
    calendarSubtitle: "Alle Prüfungstermine, Uhrzeiten und Hörsäle im Überblick",
    addExamDateBtn: "+ Prüfungstermin eintragen",
    addExamModalTitle: "Klausurtermin eintragen & zuordnen",
    addExamModalDesc: "Trage Datum, Raum und Klausuraufbau ein.",
    selectModuleOrMatchLabel: "Modul auswählen oder per Suchbegriff automatisch zuordnen",
    smartAutoMatchBadge: "✨ Smart Auto-Match",
    searchModulePlaceholder: "Tippe z. B. 'Software', 'DBS' oder 'INF-201' für Auto-Erkennung...",
    autoMatchedBadge: "Automatisch zugeordnet:",
    examDateRequiredLabel: "Prüfungsdatum *",
    saveAndAssignExamBtn: "Termin speichern & zuordnen",
    examListNoExams: "Noch keine Klausuren im Kalender eingetragen.",
    daysUntilExam: "in {n} Tagen",
    locationPrefix: "Raum / Ort:",
    timePrefix: "Uhrzeit:",

    // Detail View Tabs
    tab1Name: "Tab 1: Dokumenten- & Altklausuren-Hub",
    tab2Name: "Tab 2: Klausurtrainer & Schwachstellen",
    tab3Name: "Tab 3: Noten- & Modulabschluss",
    weaknessRadarTitle: "Hier solltest du dich vertiefen (Schwachstellen-Radar)",
    weaknessRadarSubtitle: "Die 3 Themengebiete mit der geringsten Klausurreife in diesem Fach.",
    generateSummaryBtn: "Zusammenfassung generieren",
    closeGapBtn: "Lücke schließen (5 Fragen)",
    startTrainingTitle: "Training Starten (Modus wählen)",
    startTrainingSubtitle: "Wähle einen spezifischen Fragentyp oder starte eine realistische Klausursimulation.",
    singleChoiceTitle: "Single Choice",
    singleChoiceSubtitle: "1 richtige Antwort, sofortiges Feedback & Begründung.",
    multipleChoiceTitle: "Multiple Choice",
    multipleChoiceSubtitle: "1 bis mehrere Optionen mit gerechter Teilpunktevergabe.",
    freeTextTitle: "Freitext mit KI-Korrektur",
    freeTextSubtitle: "Definitionen formulieren & semantisches Folien-Feedback erhalten.",
    simulationTitleBtn: "Klausursimulation",
    simulationSubtitleBtn: "Realistischer Mix aus SC, MC & Freitext mit Prüfungsbewertung.",
    examNotesTitle: "Klausuraufbau & Dozentenhinweise:",
    editExamNotesBtn: "Klausuraufbau bearbeiten",

    // Module Detail Page - Tab 1 (Documents)
    uploadDocTitle: "Vorlesungsunterlagen oder Altklausur hochladen",
    uploadDocNameLabel: "Titel / Thema des Dokuments *",
    uploadDocNamePlaceholder: "z. B. Vorlesung 03 - Microservices & CQRS",
    categoryLabel: "Kategorie",
    catSlides: "Folien / Vorlesungsskript",
    catExercises: "Übungsblatt & Lösung",
    catLiterature: "Fachliteratur / Sonstiges",
    markAsPastExam: "Als Altklausur kennzeichnen (Steuert KI-Fragestil)",
    pastExamHint: "Wichtige Klausurfragen, Fragetiefe und Musterlösungen",
    docTextContentLabel: "Textinhalt / Vorlesungsauszug (für RAG-Vektorsuche)",
    docTextContentPlaceholder: "Füge hier den extrahierten Text, Foliensätze oder Altklausuraufgaben ein...",
    uploadAndIndexBtn: "Dokument hochladen & indexieren",
    uploadingAndIndexing: "Wird indexiert...",
    storedDocsTitle: "Hinterlegte Unterlagen",
    ragPipelineActive: "RAG Vektor-Pipeline aktiv",
    noDocsUploaded: "Noch keine Dokumente hochgeladen. Nutze das Upload-Formular links.",
    noDocsHint: "Lade PDFs, Skripte oder Altklausuren hoch.",
    ragSnippetModalTitle: "RAG-Indexauszug:",
    pastExamBadge: "Altklausur",
    indexedBadge: "Indexiert (RAG bereit)",

    // Module Detail Page - Tab 2 (Exam Structure Modal)
    editExamDetailsModalTitle: "Klausuraufbau & Termindetails bearbeiten",
    editExamDetailsModalDesc: "Definiere, wie die Prüfung aufgebaut ist. Die KI adaptiert diese Vorgaben.",
    examCommentLabel: "Kommentar: Wie wird die Klausur aussehen?",
    examCommentHint: "✨ Für KI-Klausursimulation",
    quickSnippetsLabel: "Schnellbausteine einfügen:",
    saveExamChangesBtn: "Änderungen speichern",

    // Module Detail Page - Tab 3 (Grades)
    gradesCompletionTitle: "Noten- & Modulabschluss",
    enterGradeLabel: "Erzielte Note eintragen",
    markCompletedCheckboxTitle: "Modul als \"Bestanden\" markieren",
    markCompletedCheckboxDesc: "Schließt das Modul offiziell ab. Die ECTS werden gutgeschrieben und der GPA aktualisiert.",
    gradeSavedToast: "Notenabschluss erfolgreich gespeichert! Dashboard wurde aktualisiert.",
    saveGradeAndCompletionBtn: "Abschluss & Note speichern",

    // Exam Session Modal (Trainer)
    questionOf: "Frage {current} von {total}",
    chooseSingleAnswer: "Wähle die richtige Antwort:",
    chooseMultiAnswers: "Wähle alle zutreffenden Antworten (Mehrfachauswahl möglich):",
    yourAnswerFreeText: "Deine Antwort (Freitext):",
    freeTextPlaceholder: "Schreibe deine Antwort oder Definition in eigenen Worten...",
    submitAndEvaluateBtn: "Freitext-Antwort absenden & mit Folien vergleichen",
    evaluatingAi: "KI bewertet deine Antwort anhand der Vorlesungsunterlagen...",
    evalHeader: "Prüfer-Feedback & Folien-Abgleich",
    scoreAwarded: "Punktevergabe:",
    identifiedKeywords: "Gefundene Schlüsselbegriffe:",
    missingConcepts: "Fehlende Konzepte / Vertiefung:",
    slideCitation: "Quellennachweis in den Vorlesungsunterlagen:",
    nextQuestionBtn: "Nächste Frage →",
    sessionFinishedTitle: "Training beendet!",
    sessionScorePrefix: "Ergebnis:",
    greatPerformance: "Super Leistung! Du hast das Thema sicher im Griff.",
    needsPractice: "Guter Versuch! Schließe noch die verbleibenden Wissenslücken.",
    practiceAgainBtn: "Nochmal üben",
    finishSessionBtn: "Fertigstellen",

    // Topic Summary Modal
    aiCheatSheetTitle: "KI-Zusammenfassung & Spickzettel",
    aiCheatSheetSubtitle: "Kompakter Überblick der Kernkonzepte basierend auf deinen Vorlesungsfolien",
    coreConceptsTitle: "Kernkonzepte & Definitionen:",
    examTipsTitle: "Wichtige Klausurtipps & Stolperfallen:",
    copyTextBtn: "Text kopieren",
    copiedBtn: "Kopiert!",
    closeGapNowBtn: "Lücke jetzt mit 5 Fragen schließen →",
  },
  en: {
    appName: "StudyHub",
    appSubtitle: "Smart University & Exam Workspace",
    kiBadge: "AI 2.0",
    ectsProgress: "ECTS Progress",
    gpaTracker: "Grade Point Average (GPA)",
    calendar: "Calendar",
    settings: "Settings",
    semesterOverview: "Semester Overview",
    addSemester: "Add Semester",
    semester: "Semester",
    semesters: "Semesters",
    activeSemester: "Active Semester",
    modulesInSemester: "Modules registered in this semester",
    filterAll: "All",
    filterInProgress: "In Progress",
    filterCompleted: "Completed",
    addModule: "Add New Course",
    noModulesFound: "No courses found",
    noModulesHint: "No courses registered for this semester yet. Start by creating your first course!",
    firstModuleBtn: "Create First Course",
    examReadiness: "Exam Readiness Score",
    dailyGoal: "Daily Goal",
    dueQuestions: "due",
    examToday: "Exam TODAY!",
    daysRemaining: "{n} days left",
    noExamDate: "No exam date set",
    documents: "Materials",
    examTrainer: "Exam Trainer",
    openTrainer: "Open Exam Trainer",
    passed: "Passed",
    inProgress: "In Preparation",
    planned: "Planned",
    failed: "Failed",
    grade: "Grade",

    // Shared actions
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    delete: "Delete",
    close: "Close",
    edit: "Edit",
    today: "Today",
    month: "Month",
    list: "List",
    back: "Back",

    // ECTS Calculator modal
    ectsCalculatorTitle: "ECTS Calculator & Semester Performance Analytics",
    ectsCalculatorSubtitle: "Overview of all academic credits, semester breakdowns and average calculation",
    totalCollected: "Total Earned ECTS",
    targetEcts: "Target ECTS",
    avgEctsPerSemester: "Avg ECTS per Semester",
    semestersCount: "Recorded Semesters",
    standardComparison: "Standard Study Pace",
    estimatedSemestersLeft: "Estimated Semesters Left",
    semesterBreakdownTitle: "Semester-by-Semester Credit Breakdown",
    modulesCompleted: "Modules completed",
    noModulesInSemester: "No completed modules in this semester yet.",
    simulationTitle: "Graduation Planner & Pace Simulation",
    simulationPace: "Planned ECTS per semester:",
    simulationTarget: "Estimated graduation in:",

    // Settings modal
    settingsTitle: "Settings & AI Engine",
    settingsTargetEctsLabel: "Target ECTS for Degree",
    settingsCustom: "Custom:",
    settingsAiModeLabel: "AI Mode for Exam Evaluation",
    settingsLocalTitle: "Built-in RAG Semantic Engine (Default)",
    settingsLocalNoKey: "No Key Required",
    settingsLocalDesc: "Evaluates free text locally using lecture slides & past exams.",
    settingsOpenAiDesc: "State-of-the-art LLM analysis with differentiated scoring.",
    settingsAnthropicDesc: "Outstanding academic reasoning and detailed justifications.",
    settingsApiKeyLabel: "API Key for",
    settingsApiKeyHint: "Saved strictly locally in your browser storage.",
    settingsResetDemoTitle: "Reset Demo Data",
    settingsResetDemoDesc: "Reloads sample semesters, Software Engineering & Database Systems II.",
    settingsResetDemoBtn: "Reset Data",
    settingsResetDemoLoaded: "Loaded!",

    // Semester Modals
    setAsActive: "Set as current",
    rename: "Rename",
    deleteSemester: "Delete semester",
    addSemesterTitle: "Create New Semester",
    addSemesterDesc: "Choose a quick preset or enter a custom semester title.",
    quickPresetsLabel: "Quick presets:",
    semesterNameLabel: "Semester title",
    semesterNamePlaceholder: "e.g. Summer Semester 2027",
    markAsActiveCheckbox: "Mark as currently active semester",
    creatingSemester: "Creating...",
    saveSemesterBtn: "Save Semester",
    editSemesterTitle: "Edit Semester",
    editSemesterNameLabel: "Title",
    savingChanges: "Save Changes",

    // Add Module Modal
    addModuleTitle: "Add New Course / Module",
    addModuleDesc: "Enter core course details and optional exam schedule.",
    moduleNameLabel: "Course Name *",
    moduleNamePlaceholder: "e.g. Software Engineering & Architecture",
    moduleCodeLabel: "Course Code (optional)",
    moduleCodePlaceholder: "e.g. CS-201",
    ectsLabel: "ECTS Credits *",
    examDateLabel: "Exam Date (for Countdown Planner)",
    examTimeLabel: "Time (optional)",
    examTimePlaceholder: "e.g. 10:00 AM – 12:00 PM",
    examLocationLabel: "Room / Location (optional)",
    examLocationPlaceholder: "e.g. Auditorium 1A",
    examStructureLabel: "Exam Format & Lecturer Notes",
    aiRelevantBadge: "✨ AI Relevant",
    examStructurePlaceholder: "e.g. 90 min, 30% Multiple Choice, 70% Free Text. Professor stresses exact definitions. 1 sheet cheat sheet allowed.",
    statusLabel: "Status",
    statusInProgress: "In Preparation",
    statusPlanned: "Planned",
    statusCompleted: "Already Passed",
    createModuleBtn: "Create Course",

    // Calendar & Exam Modal
    calendarTitle: "Exam Calendar & Deadlines",
    calendarSubtitle: "All exam dates, schedules and lecture halls at a glance",
    addExamDateBtn: "+ Schedule Exam Date",
    addExamModalTitle: "Schedule & Match Exam Date",
    addExamModalDesc: "Enter exam date, room and format notes.",
    selectModuleOrMatchLabel: "Select course or auto-match via search term",
    smartAutoMatchBadge: "✨ Smart Auto-Match",
    searchModulePlaceholder: "Type 'Software', 'DBS' or 'CS-201' for instant matching...",
    autoMatchedBadge: "Automatically matched:",
    examDateRequiredLabel: "Exam Date *",
    saveAndAssignExamBtn: "Save & Assign Exam",
    examListNoExams: "No exam dates scheduled in the calendar yet.",
    daysUntilExam: "in {n} days",
    locationPrefix: "Room / Location:",
    timePrefix: "Time:",

    // Detail View Tabs
    tab1Name: "Tab 1: Documents & Past Exams Hub",
    tab2Name: "Tab 2: Exam Trainer & Knowledge Gaps",
    tab3Name: "Tab 3: Grades & Course Completion",
    weaknessRadarTitle: "Areas to Focus On (Knowledge Radar)",
    weaknessRadarSubtitle: "The 3 topics with the lowest exam readiness score in this subject.",
    generateSummaryBtn: "Generate Summary",
    closeGapBtn: "Close Gap (5 Questions)",
    startTrainingTitle: "Start Training (Choose Mode)",
    startTrainingSubtitle: "Select a specific question type or launch a realistic exam simulation.",
    singleChoiceTitle: "Single Choice",
    singleChoiceSubtitle: "1 correct answer, instant feedback and detailed explanation.",
    multipleChoiceTitle: "Multiple Choice",
    multipleChoiceSubtitle: "1 or more correct choices with partial credit scoring.",
    freeTextTitle: "Free Text with AI Grading",
    freeTextSubtitle: "Draft definitions & get semantic lecture slide feedback.",
    simulationTitleBtn: "Exam Simulation",
    simulationSubtitleBtn: "Realistic mix of SC, MC & Free Text under test conditions.",
    examNotesTitle: "Exam Structure & Lecturer Notes:",
    editExamNotesBtn: "Edit Exam Notes",

    // Module Detail Page - Tab 1 (Documents)
    uploadDocTitle: "Upload Lecture Materials or Past Exams",
    uploadDocNameLabel: "Title / Topic of the Document *",
    uploadDocNamePlaceholder: "e.g. Lecture 03 - Microservices & CQRS",
    categoryLabel: "Category",
    catSlides: "Slides / Lecture Script",
    catExercises: "Exercise & Solution",
    catLiterature: "Literature / Other",
    markAsPastExam: "Mark as Past Exam (Guides AI Question Style)",
    pastExamHint: "Authentic exam questions, depth and reference solutions",
    docTextContentLabel: "Text Content / Excerpt (for RAG Vector Search)",
    docTextContentPlaceholder: "Paste extracted text, slide contents, or past exam tasks here...",
    uploadAndIndexBtn: "Upload & Index Document",
    uploadingAndIndexing: "Indexing...",
    storedDocsTitle: "Uploaded Materials",
    ragPipelineActive: "RAG Vector Pipeline Active",
    noDocsUploaded: "No materials uploaded yet. Use the upload form on the left.",
    noDocsHint: "Upload PDFs, lecture scripts, or past exams.",
    ragSnippetModalTitle: "RAG Index Snippet:",
    pastExamBadge: "Past Exam",
    indexedBadge: "Indexed (RAG Ready)",

    // Module Detail Page - Tab 2 (Exam Structure Modal)
    editExamDetailsModalTitle: "Edit Exam Format & Details",
    editExamDetailsModalDesc: "Specify how the exam is structured. The AI trainer will adapt to these requirements.",
    examCommentLabel: "Notes: What will the exam look like?",
    examCommentHint: "✨ For AI Exam Simulation",
    quickSnippetsLabel: "Insert quick snippets:",
    saveExamChangesBtn: "Save Changes",

    // Module Detail Page - Tab 3 (Grades)
    gradesCompletionTitle: "Grades & Course Completion",
    enterGradeLabel: "Enter achieved grade",
    markCompletedCheckboxTitle: "Mark course as \"Passed\"",
    markCompletedCheckboxDesc: "Officially completes the module. ECTS credits are credited and GPA is updated.",
    gradeSavedToast: "Grade successfully saved! Dashboard has been updated.",
    saveGradeAndCompletionBtn: "Save Grade & Completion",

    // Exam Session Modal (Trainer)
    questionOf: "Question {current} of {total}",
    chooseSingleAnswer: "Choose the correct answer:",
    chooseMultiAnswers: "Choose all applicable answers (multiple choice):",
    yourAnswerFreeText: "Your answer (Free text):",
    freeTextPlaceholder: "Formulate your answer or definition in your own words...",
    submitAndEvaluateBtn: "Submit Free Text & Compare with Slides",
    evaluatingAi: "AI is evaluating your answer against lecture materials...",
    evalHeader: "Examiner Feedback & Slide Citations",
    scoreAwarded: "Score Awarded:",
    identifiedKeywords: "Identified Key Concepts:",
    missingConcepts: "Missing Concepts / Deepen Study:",
    slideCitation: "Source Citation from Lecture Slides:",
    nextQuestionBtn: "Next Question →",
    sessionFinishedTitle: "Training Session Completed!",
    sessionScorePrefix: "Result:",
    greatPerformance: "Outstanding performance! You have mastered this topic.",
    needsPractice: "Good effort! Review the remaining knowledge gaps.",
    practiceAgainBtn: "Practice Again",
    finishSessionBtn: "Done",

    // Topic Summary Modal
    aiCheatSheetTitle: "AI Summary & Cheat Sheet",
    aiCheatSheetSubtitle: "Compact overview of core concepts extracted from your lecture slides",
    coreConceptsTitle: "Core Concepts & Definitions:",
    examTipsTitle: "Important Exam Tips & Common Pitfalls:",
    copyTextBtn: "Copy Text",
    copiedBtn: "Copied!",
    closeGapNowBtn: "Close Knowledge Gap (5 Questions) →",
  },
};

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "de",
  setLang: () => {},
  t: translations.de,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("de");

  useEffect(() => {
    const stored = localStorage.getItem("studyhub_lang") as Language | null;
    if (stored === "de" || stored === "en") {
      setLangState(stored);
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("studyhub_lang", newLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
