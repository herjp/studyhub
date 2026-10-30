import { PrismaClient, ModuleStatus, DocumentCategory, QuestionType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Clearing old database data...");
  await prisma.questionProgress.deleteMany();
  await prisma.question.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.document.deleteMany();
  await prisma.module.deleteMany();
  await prisma.semester.deleteMany();

  console.log("📅 Creating Semesters...");
  const ws25 = await prisma.semester.create({
    data: {
      name: "Wintersemester 2025/26",
      startDate: new Date("2025-10-01"),
      endDate: new Date("2026-03-31"),
      isActive: false,
      order: 1,
    },
  });

  const ss26 = await prisma.semester.create({
    data: {
      name: "Sommersemester 2026",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-09-30"),
      isActive: true,
      order: 2,
    },
  });

  const ws26 = await prisma.semester.create({
    data: {
      name: "Wintersemester 2026/27",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2027-03-31"),
      isActive: false,
      order: 3,
    },
  });

  console.log("📚 Creating Completed Modules in WS 2025/26...");
  await prisma.module.create({
    data: {
      semesterId: ws25.id,
      name: "Mathematik für Informatiker I",
      code: "MAT-101",
      ects: 8.0,
      status: ModuleStatus.COMPLETED,
      grade: 1.7,
      examDate: new Date("2026-02-15"),
    },
  });

  await prisma.module.create({
    data: {
      semesterId: ws25.id,
      name: "Programmierung I (Java)",
      code: "INF-101",
      ects: 6.0,
      status: ModuleStatus.COMPLETED,
      grade: 1.3,
      examDate: new Date("2026-02-22"),
    },
  });

  await prisma.module.create({
    data: {
      semesterId: ws25.id,
      name: "Theoretische Informatik I",
      code: "INF-102",
      ects: 6.0,
      status: ModuleStatus.COMPLETED,
      grade: 2.0,
      examDate: new Date("2026-03-05"),
    },
  });

  console.log("🚀 Creating Active Modules in Sommersemester 2026...");
  // Module 1: Software Engineering & Architektur
  const examDateSWE = new Date();
  examDateSWE.setDate(examDateSWE.getDate() + 18); // In 18 Tagen

  const modSWE = await prisma.module.create({
    data: {
      semesterId: ss26.id,
      name: "Software Engineering & Architektur",
      code: "INF-201",
      ects: 6.0,
      status: ModuleStatus.IN_PROGRESS,
      examDate: examDateSWE,
      examTime: "10:00 – 11:30",
      examLocation: "Hörsaal 2A (Campus Süd)",
      examDescription: "Dauer: 90 Minuten. Aufbau: 25% Single-/Multiple-Choice (Grundlagen), 45% Freitext-Architekturanalyse (Microservices, DDD, CQRS) und 30% Entwurfsmuster / UML-Modellierung. Hilfsmittel: Ein beidseitig handbeschriebenes DIN-A4-Blatt erlaubt.",
    },
  });

  // Module 2: Datenbanksysteme II
  const examDateDBS = new Date();
  examDateDBS.setDate(examDateDBS.getDate() + 32);

  const modDBS = await prisma.module.create({
    data: {
      semesterId: ss26.id,
      name: "Datenbanksysteme II",
      code: "INF-204",
      ects: 6.0,
      status: ModuleStatus.IN_PROGRESS,
      examDate: examDateDBS,
      examTime: "14:00 – 15:30",
      examLocation: "Audimax (Zentralcampus)",
      examDescription: "Dauer: 90 Minuten. Fokus: Transaktionsverwaltung (ACID, Isolationsstufen, 2PL-Sperren), B-Baum-Indexierung und NoSQL-Konsistenz. Taschenrechner nicht programmierbar erlaubt.",
    },
  });

  // Module 3: Algorithmen & Komplexität
  const examDateAlgo = new Date();
  examDateAlgo.setDate(examDateAlgo.getDate() + 48);

  const modAlgo = await prisma.module.create({
    data: {
      semesterId: ss26.id,
      name: "Algorithmen & Komplexität",
      code: "INF-105",
      ects: 8.0,
      status: ModuleStatus.IN_PROGRESS,
      examDate: examDateAlgo,
      examTime: "09:00 – 11:00",
      examLocation: "Hörsaal 1B",
      examDescription: "Dauer: 120 Minuten. Klausuraufbau: Beweise zu NP-Vollständigkeit, Graphenalgorithmen (Dijkstra/A*) und dynamische Programmierung. Keine Hilfsmittel erlaubt.",
    },
  });

  console.log("📑 Creating Topics for Software Engineering...");
  const topicArch = await prisma.topic.create({
    data: {
      moduleId: modSWE.id,
      name: "Software-Architekturmuster & Microservices",
      masteryScore: 68.0,
      summary: "Zentrale Architekturmuster: Layered Architecture, Clean Architecture, CQRS und Microservices. Trennung von Fachlogik und Infrastruktur. Lose Kopplung über REST/Messaging.",
    },
  });

  const topicPatterns = await prisma.topic.create({
    data: {
      moduleId: modSWE.id,
      name: "Entwurfsmuster (GoF Patterns)",
      masteryScore: 78.0,
      summary: "Erzeugungsmuster (Factory, Singleton, Builder), Strukturmuster (Adapter, Decorator, Facade), Verhaltensmuster (Observer, Strategy, State).",
    },
  });

  const topicProcess = await prisma.topic.create({
    data: {
      moduleId: modSWE.id,
      name: "Prozessmodellierung & Agilität (Scrum / Kanban)",
      masteryScore: 32.0, // Schwachstelle
      summary: "Scrum Rollen (Product Owner, Scrum Master, Developers), Artefakte (Sprint Backlog, Increment, Definition of Done), Events (Sprint Planning, Daily, Review, Retro). Kanban WIP-Limits.",
    },
  });

  const topicTesting = await prisma.topic.create({
    data: {
      moduleId: modSWE.id,
      name: "Testing, CI/CD & Codequalität",
      masteryScore: 42.0, // Schwachstelle
      summary: "Testpyramide (Unit, Integration, E2E), Mocking, Test-Driven Development (TDD: Red-Green-Refactor), Continuous Integration & Deployment Pipelines.",
    },
  });

  console.log("📑 Creating Documents for Software Engineering...");
  await prisma.document.create({
    data: {
      moduleId: modSWE.id,
      title: "Vorlesung_03_Softwarearchitektur_Pattern.pdf",
      fileName: "Vorlesung_03_Softwarearchitektur_Pattern.pdf",
      fileUrl: "/docs/Vorlesung_03_Softwarearchitektur_Pattern.pdf",
      category: DocumentCategory.LECTURE_SLIDES,
      isIndexed: true,
      parsedText: `KAPITEL 3: SOFTWARE-ARCHITEKTURMUSTER
Folie 12: Microservices vs. Monolith
Ein Monolith bündelt alle Komponenten in einer einheitlichen Deployment-Einheit. Vorteile: Einfaches lokales Debugging, keine Netzwerk-Latenzen zwischen Modulen. Nachteile: Skalierung nur als Ganzes möglich, enge Kopplung, hohe Deployment-Risiken bei Änderungen.
Microservices zerlegen das System in autarke, fachlich geschnittene Dienste (Bounded Contexts nach DDD). Jeder Service besitzt seine eigene Datenbank (Database-per-Service). Kommunikation erfolgt asynchron über Message Broker (z.B. Kafka, RabbitMQ) oder synchron über REST/gRPC.
Folie 18: CQRS (Command Query Responsibility Segregation)
CQRS trennt Schreib- und Leseoperationen in zwei getrennte Modelle. Commands verändern den Zustand (Write Model), Queries lesen aggregierte Daten (Read Model). Dies ermöglicht hochgradige Optimierung der Leseseite und Event Sourcing.`,
    },
  });

  await prisma.document.create({
    data: {
      moduleId: modSWE.id,
      title: "Altklausur_SoSe2025_Haupttermin.pdf",
      fileName: "Altklausur_SoSe2025_Haupttermin.pdf",
      fileUrl: "/docs/Altklausur_SoSe2025_Haupttermin.pdf",
      category: DocumentCategory.EXAM_PAST,
      isIndexed: true,
      parsedText: `UNIVERSITÄTSKLAUSUR SOFTWARE ENGINEERING (SoSe 2025)
Aufgabe 2 (8 Punkte): Architekturvergleich
Diskutieren Sie die Herausforderungen von Microservices im Vergleich zum klassischen Monolithen bezüglich Datenkonsistenz und Fehlertoleranz.
Musterlösung: Microservices können keine atomaren ACID-Transaktionen über mehrere Services hinweg garantieren (CAP-Theorem). Lösung ist Eventual Consistency über das Saga-Pattern (Choreographie oder Orchestrierung). Zur Fehlertoleranz werden Circuit Breaker (z.B. Resilience4j) eingesetzt.
Aufgabe 4 (6 Punkte): Scrum Rollen
Erläutern Sie, warum der Scrum Master in keinem Fall die Rolle des Product Owners übernehmen darf.`,
    },
  });

  await prisma.document.create({
    data: {
      moduleId: modSWE.id,
      title: "Uebung_04_Scrum_UserStories.pdf",
      fileName: "Uebung_04_Scrum_UserStories.pdf",
      fileUrl: "/docs/Uebung_04_Scrum_UserStories.pdf",
      category: DocumentCategory.EXERCISE,
      isIndexed: true,
      parsedText: `ÜBUNG 4: AGILE ENTWICKLUNG
INVEST-Kriterien für User Stories: Independent, Negotiable, Valuable, Estimable, Small, Testable.
Definition of Done (DoD) sichert Qualitätsstandards vor dem Release: Code reviewed, Unit-Tests grün, Dokumentation aktualisiert, CI Build erfolgreich.`,
    },
  });

  console.log("❓ Creating Questions for Software Engineering...");
  // Question 1: Single Choice
  const q1 = await prisma.question.create({
    data: {
      moduleId: modSWE.id,
      topicId: topicArch.id,
      type: QuestionType.SINGLE_CHOICE,
      questionText: "Welches Entwurfsmuster empfiehlt sich bei Microservices, um verteilte Transaktionen über mehrere Teildienste ohne Distributed Two-Phase-Commit zu steuern?",
      options: JSON.stringify([
        { text: "Saga Pattern (Choreographie / Orchestrierung)", isCorrect: true, explanation: "Das Saga-Pattern nutzt Sequenzen lokaler Transaktionen mit kompensierenden Aktionen zur Gewährleistung von Eventual Consistency." },
        { text: "Singleton Pattern", isCorrect: false, explanation: "Singleton sichert lediglich ab, dass eine Klasse nur eine Instanz besitzt." },
        { text: "Visitor Pattern", isCorrect: false, explanation: "Visitor trennt Algorithmen von den Datenstrukturen, auf denen sie operieren." },
        { text: "Observer Pattern im Monolithen", isCorrect: false, explanation: "Reicht nicht für verteilte Konsistenzsicherung mit Fehler-Kompensation aus." },
      ]),
      sampleSolution: "Saga Pattern",
      sourceRef: "Vorlesung_03_Softwarearchitektur_Pattern.pdf, Folie 18",
    },
  });

  await prisma.questionProgress.create({
    data: {
      questionId: q1.id,
      intervalDays: 3,
      nextReviewDate: new Date(Date.now() + 86400000 * 2),
      lastWasCorrect: true,
      lastAnswerDate: new Date(),
    },
  });

  // Question 2: Multiple Choice
  const q2 = await prisma.question.create({
    data: {
      moduleId: modSWE.id,
      topicId: topicProcess.id,
      type: QuestionType.MULTIPLE_CHOICE,
      questionText: "Welche der folgenden Aussagen treffen auf das Scrum-Framework und dessen Rollen zu? (Wähle alle zutreffenden Aussagen)",
      options: JSON.stringify([
        { text: "Der Product Owner priorisiert das Product Backlog nach betriebswirtschaftlichem Nutzen.", isCorrect: true, explanation: "Richtig. Der PO verantwortet den Return on Investment und die Wertmaximierung des Produkts." },
        { text: "Der Scrum Master leitet das Daily Scrum und weist den Entwicklern die Tasks zu.", isCorrect: false, explanation: "Falsch! Das Team ist selbstorganisiert; der Scrum Master ist Servant Leader und moderiert nur bei Hindernissen." },
        { text: "Die Definition of Done (DoD) legt fest, wann ein Inkrement als potenziell auslieferbar gilt.", isCorrect: true, explanation: "Richtig. Sie ist die gemeinsame Qualitätsvereinbarung des gesamten Teams." },
        { text: "Ein Sprint kann maximal 3 Monate andauern.", isCorrect: false, explanation: "Falsch. Laut Scrum Guide dauert ein Sprint höchstens 1 Monat (meist 2-4 Wochen)." },
      ]),
      sampleSolution: "Aussagen 1 und 3 sind korrekt.",
      sourceRef: "Altklausur_SoSe2025_Haupttermin.pdf, Aufgabe 4",
    },
  });

  await prisma.questionProgress.create({
    data: {
      questionId: q2.id,
      intervalDays: 1,
      nextReviewDate: new Date(), // Heute fällig!
      lastWasCorrect: false,
      lastAnswerDate: new Date(Date.now() - 86400000),
    },
  });

  // Question 3: Free Text
  const q3 = await prisma.question.create({
    data: {
      moduleId: modSWE.id,
      topicId: topicArch.id,
      type: QuestionType.FREE_TEXT,
      questionText: "Erläutern Sie das architektonische Prinzip 'Database-per-Service' in einer Microservices-Landschaft. Welche Vorteile und welche konkreten Herausforderungen bezüglich Datenabfragen entstehen hierbei?",
      sampleSolution: `Prinzip: Jeder Microservice besitzt und kapselt seine eigene Datenbank exklusiv; kein anderer Service greift direkt auf die Tabellen zu.
Vorteile:
- Lose Kopplung und Unabhängigkeit bei Schema-Migrationen.
- Freie Wahl der passenden Datenbanktechnologie (Polyglot Persistence).
Herausforderungen:
- Verteilte Joins sind nicht direkt per SQL möglich.
- Daten müssen über APIs oder Event Streams repliziert werden.
- Abfragen erfordern z.B. das API-Composition-Pattern oder CQRS mit eigenem Read Model.`,
      sourceRef: "Vorlesung_03_Softwarearchitektur_Pattern.pdf, Folie 12 & Altklausur Aufgabe 2",
    },
  });

  await prisma.questionProgress.create({
    data: {
      questionId: q3.id,
      intervalDays: 1,
      nextReviewDate: new Date(), // Heute fällig!
      lastWasCorrect: null,
    },
  });

  // Question 4: Single Choice on Testing
  const q4 = await prisma.question.create({
    data: {
      moduleId: modSWE.id,
      topicId: topicTesting.id,
      type: QuestionType.SINGLE_CHOICE,
      questionText: "Was versteht man unter dem Prinzip der Testpyramide nach Mike Cohn?",
      options: JSON.stringify([
        { text: "Eine breite Basis schneller, isolierter Unit-Tests, gefolgt von weniger Integrationstests und sehr wenigen teuren UI/E2E-Tests.", isCorrect: true, explanation: "Exakt. Unit-Tests sind billig und schnell; End-to-End-Tests sind fragil und langsam, daher ganz oben an der Spitze." },
        { text: "Ausschließlich manuelle Tests für maximale Fehlerfindung.", isCorrect: false, explanation: "Falsch. Das Ziel ist maximale automatisierte Testabdeckung." },
        { text: "Die Pyramide besagt, dass E2E-Tests mindestens 80% des Testaufwands ausmachen sollten.", isCorrect: false, explanation: "Falsch. Das wäre die Anti-Pattern 'Test-Eistüte'." },
        { text: "Dass Tests erst nach dem vollständigen Produktiv-Release geschrieben werden.", isCorrect: false, explanation: "Falsch." },
      ]),
      sampleSolution: "Breite Basis schneller Unit-Tests, wenige E2E-Tests.",
      sourceRef: "Uebung_04_Scrum_UserStories.pdf, Abschnitt Testing",
    },
  });

  await prisma.questionProgress.create({
    data: {
      questionId: q4.id,
      intervalDays: 1,
      nextReviewDate: new Date(), // Heute fällig
      lastWasCorrect: false,
    },
  });

  // Question 5: Multiple Choice on Design Patterns
  await prisma.question.create({
    data: {
      moduleId: modSWE.id,
      topicId: topicPatterns.id,
      type: QuestionType.MULTIPLE_CHOICE,
      questionText: "Welche der folgenden Entwurfsmuster zählen zur Kategorie der 'Verhaltensmuster' (Behavioral Patterns) nach der Gang of Four?",
      options: JSON.stringify([
        { text: "Observer Pattern", isCorrect: true, explanation: "Richtig. Ermöglicht 1:n Benachrichtigung bei Zustandsänderungen." },
        { text: "Strategy Pattern", isCorrect: true, explanation: "Richtig. Kapselt austauschbare Algorithmen in separaten Klassen." },
        { text: "Factory Method", isCorrect: false, explanation: "Falsch. Gehört zu den Erzeugungsmustern (Creational)." },
        { text: "Adapter Pattern", isCorrect: false, explanation: "Falsch. Gehört zu den Strukturmustern (Structural)." },
      ]),
      sampleSolution: "Observer und Strategy",
      sourceRef: "Vorlesung_03_Softwarearchitektur_Pattern.pdf, Folie 24",
    },
  });

  // Question 6: Free Text on Process
  await prisma.question.create({
    data: {
      moduleId: modSWE.id,
      topicId: topicProcess.id,
      type: QuestionType.FREE_TEXT,
      questionText: "Definieren Sie den Begriff 'WIP-Limit' (Work-in-Progress Limit) in Kanban und erläutern Sie dessen positiven Einfluss auf den Durchsatz und die Zykluszeit (Cycle Time).",
      sampleSolution: `WIP-Limits beschränken die maximale Anzahl gleichzeitig bearbeiteter Aufgaben in einer Spalte/Station des Kanban-Boards.
Einfluss:
- Verhindert Multitasking und Kontextwechsel.
- Macht Engpässe (Bottlenecks) sofort sichtbar (Stau vor überlasteten Stationen).
- Nach dem Gesetz von Little (Cycle Time = WIP / Throughput) führt eine Reduktion des WIP bei konstanter Kapazität direkt zu einer Verkürzung der Durchlaufzeit (Cycle Time).`,
      sourceRef: "Uebung_04_Scrum_UserStories.pdf, Seite 5",
    },
  });

  // Also seed some items for Datenbanken II
  const topicACID = await prisma.topic.create({
    data: {
      moduleId: modDBS.id,
      name: "Transaktionsverwaltung & ACID",
      masteryScore: 42.0,
      summary: "Atomarität, Konsistenz, Isolation, Dauerhaftigkeit. Isolationslevel (Read Uncommitted, Read Committed, Repeatable Read, Serializable) und Phänomene (Dirty Read, Non-Repeatable Read, Phantom Read).",
    },
  });

  await prisma.document.create({
    data: {
      moduleId: modDBS.id,
      title: "DBS2_Kapitel4_Transaktionen_ACID.pdf",
      fileName: "DBS2_Kapitel4_Transaktionen_ACID.pdf",
      fileUrl: "/docs/DBS2_Kapitel4_Transaktionen_ACID.pdf",
      category: DocumentCategory.LECTURE_SLIDES,
      isIndexed: true,
      parsedText: `KAPITEL 4: TRANSAKTIONEN & ISOLATION
Folie 7: Phänomene der Nebenläufigkeit
- Dirty Read: Eine Transaktion T2 liest Daten, die von T1 modifiziert, aber noch nicht committet wurden (und evtl. per Rollback verworfen werden).
- Non-Repeatable Read: T1 liest denselben Datensatz zweimal und erhält unterschiedliche Werte, weil T2 dazwischen committet hat.
- Phantom Read: T1 führt eine Bereichsabfrage (WHERE) zweimal aus; T2 fügt neue passende Tupel ein.
Folie 15: Zwei-Phasen-Sperrprotokoll (2PL)
Garantiert Serialisierbarkeit. Wachstumsphase: Nur Sperren akquirieren. Schrumpfungsphase: Nur Sperren freigeben. Strict 2PL hält alle exklusiven Sperren bis zum Commit.`,
    },
  });

  const qDbs1 = await prisma.question.create({
    data: {
      moduleId: modDBS.id,
      topicId: topicACID.id,
      type: QuestionType.SINGLE_CHOICE,
      questionText: "Welches Nebenläufigkeitsphänomen wird bereits auf dem ANSI-SQL Isolationslevel 'Read Committed' zuverlässig verhindert?",
      options: JSON.stringify([
        { text: "Dirty Read", isCorrect: true, explanation: "Richtig! Read Committed garantiert, dass nur bereits committete Daten gelesen werden können." },
        { text: "Phantom Read", isCorrect: false, explanation: "Falsch. Phantom Reads werden erst ab Serializable (oder in InnoDB über Next-Key Locks bei Repeatable Read) verhindert." },
        { text: "Non-Repeatable Read", isCorrect: false, explanation: "Falsch. Das wird erst durch Repeatable Read verhindert." },
        { text: "Deadlock", isCorrect: false, explanation: "Falsch. Deadlocks können auf jedem Sperr-Level entstehen." },
      ]),
      sampleSolution: "Dirty Read",
      sourceRef: "DBS2_Kapitel4_Transaktionen_ACID.pdf, Folie 7",
    },
  });

  await prisma.questionProgress.create({
    data: {
      questionId: qDbs1.id,
      intervalDays: 1,
      nextReviewDate: new Date(),
    },
  });

  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
