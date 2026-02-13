ATR MANTA – Weight & Balance System

Sistema completo per il calcolo, visualizzazione e generazione documentale del Weight & Balance dell’ATR 42 MPA (MANTA).

Il progetto è composto da:
	•	Motore di calcolo deterministico
	•	Server applicativo
	•	Interfaccia web completa (UI + UX responsive)
	•	Generazione PNG e PDF
	•	Configurazione persistente aeromobile
	•	Test numerici di regressione (golden)

Non dipende da Excel.

⸻

Filosofia del progetto

Il sistema è stato progettato per:
	•	Riprodurre fedelmente la logica operativa storicamente implementata in Excel
	•	Eliminare ambiguità tipiche dei fogli di calcolo
	•	Separare rigidamente calcolo, configurazione e interfaccia
	•	Essere testabile e verificabile numericamente
	•	Essere estendibile senza alterare il motore

Il motore è indipendente dalla UI.
La UI non contiene logica di calcolo.

⸻

Architettura generale

Il sistema è strutturato su quattro livelli logici.

1️⃣ Dataset (datasets/*.json)

Verità strutturale certificata dell’aeromobile.

Contiene:
	•	Weighed weight (peso + momento)
	•	Cataloghi strutturali:
	•	configItems
	•	cabinCrewStations
	•	cargoStations
	•	SV
	•	Limiti strutturali:
	•	pesi massimi/minimi
	•	limiti cargo
	•	envelope CG (structural + operational)

Caratteristiche:
	•	Non modificabile dall’utente
	•	Deriva dalla pesata ufficiale
	•	Specifico per variante

👉 Rappresenta l’aeromobile certificato.

⸻

2️⃣ State / Config (state/*.config.json)

Configurazione persistente dell’aeromobile.
	•	Override rispetto alla pesata
	•	Indica cosa è installato o rimosso
	•	Persistente tra i voli
	•	Non altera mai il dataset

Risponde alla domanda:

“Questo aeromobile oggi è configurato come?”

La configurazione viene gestita tramite API REST dal server.

⸻

3️⃣ Scenario Standard (src/scenarios/*.standard.ts)

Condizione iniziale di un singolo volo.
	•	Reset a ogni caricamento variante
	•	Minimum crew
	•	SV standard
	•	Cargo standard
	•	Fuel standard
	•	Basic Index Correction = 0

👉 È l’equivalente del foglio Excel appena aperto.

⸻

4️⃣ User Input (UI runtime)

Variazioni operative del singolo volo:
	•	Cargo missione
	•	Fuel reale
	•	Crew / Pax
	•	Basic Index Correction (zone D / E / F / G)
	•	SV opzionali

L’utente non può:
	•	Modificare pesata
	•	Modificare arm certificati
	•	Modificare limiti strutturali

⸻

Pipeline di calcolo

DATASET
   ↓
STATE (config persistente)
   ↓
SCENARIO standard
   ↓
USER INPUT
   ↓
computeWB()

La pipeline è rigida e intenzionale.

⸻

Logica di calcolo

Sequenza applicativa:
	1.	Weighed Weight
	2.	Minimum Crew
	3.	Configurazione aeromobile (installato / rimosso)
	4.	SV e dotazioni
	5.	Cargo DOW
	6.	DOW
	7.	LT BASE (Observer_1 sempre rimosso)
	8.	Basic Index Correction (zone D / E / F / G)
	9.	Crew / Pax
	10.	Cargo missione
	11.	Zero Fuel Condition
	12.	Fuel (Takeoff / Landing)
	13.	Trim
	14.	Verifica limiti di peso

Il motore:
	•	Calcola ZFW / TOW / LDW
	•	Restituisce envelope strutturali e operativi
	•	Non prende decisioni grafiche

⸻

Envelope CG

Definita nel dataset come poligono chiuso in spazio:

(weightKg, index)

Esistono due livelli:
	•	Structural envelope
	•	Operational envelope

Il motore:
	•	Restituisce envelope
	•	Calcola punti
	•	Non effettua validazione grafica inside/outside

La UI è responsabile della rappresentazione grafica.

⸻

Geometria – doppia implementazione intenzionale

src/math.ts

Funzione pura:
pointInPolygon(weightKg, index, poly)

Usata per:
	•	test matematici
	•	tooling
	•	validazioni numeriche

src/geometry/isPointInsideEnvelope.ts

Pensata per:
	•	UI
	•	rendering
	•	overlay grafico

Le due funzioni non devono essere unificate.

⸻

Server Applicativo

Il progetto include un server HTTP che espone:
	•	GET /scenario/:variant
	•	POST /compute
	•	GET /config-items/:variant
	•	POST /config-items/:variant
	•	POST /config-items/:variant/print/pdf
	•	POST /export/pdf
	•	GET /weighing-info
	•	GET /health

Il server:
	•	Collega UI e motore
	•	Genera render PNG
	•	Genera PDF finali
	•	Gestisce configurazione persistente

⸻

UI Web

Interfaccia completa sviluppata in HTML + JS vanilla.

Caratteristiche:
	•	Layout desktop a doppio pannello
	•	Layout tablet (stack verticale)
	•	Layout mobile con:
	•	top bar dedicata
	•	bottom navigation (Input / Load & Trim Sheet)
	•	menu laterale con About, Dati ufficiali, Export PDF
	•	Overlay spinner durante export PDF
	•	Config items persistenti
	•	Visualizzazione errori e warning motore
	•	Render PNG dinamico
	•	Generazione PDF dinamica

L’interfaccia è completamente responsive:
	•	Desktop
	•	iPad
	•	iPhone / Android

⸻

Generazione documentale

Il sistema supporta:
	•	Render PNG pagina di calcolo
	•	Export PDF ufficiale
	•	Print PDF configurazione aeromobile

Il PDF viene generato lato server e restituito come URL dinamico.

⸻

Test numerici (Golden Tests)

Ogni variante MANTA ha uno scenario congelato.

Se il test fallisce, il comportamento del motore è cambiato.

Creazione golden:

npx ts-node tools/dumpScenario_10_01.ts
npx ts-node tools/dumpScenario_10_02.ts
npx ts-node tools/dumpScenario_10_03.ts

Esecuzione test:

npx vitest run


Esecuzione

CLI:

npx ts-node src/index.ts 10-01

Render PNG:

npx ts-node tools/render_test_page.ts 10-01

Avvio server:

npx ts-node src/server.ts

Stato attuale del progetto
	•	✔️ Motore completo
	•	✔️ 3 varianti MANTA operative
	•	✔️ Golden tests attivi
	•	✔️ Server HTTP completo
	•	✔️ UI completa
	•	✔️ UX responsive desktop / tablet / mobile
	•	✔️ Export PDF operativo
	•	✔️ Config persistente via API
	•	✔️ Envelope strutturali e operativi modellati
	•	✔️ Validazione input

Il sistema è operativo end-to-end.

⸻

Nota architetturale fondamentale

Qualsiasi estensione futura:
	•	Integrazione FMS
	•	Interfaccia avionica
	•	Estensione ATR / P-180
	•	Nuove varianti
	•	Nuovi output documentali

Non deve modificare il motore di calcolo.

Il motore è il nucleo stabile del sistema.

UI, server e export devono limitarsi a:
	•	Fornire input controllati
	•	Interpretare output
	•	Presentare risultati