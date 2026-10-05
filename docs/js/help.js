// In-app instructions (Dutch): daily routine, iOS Shortcut setup, backup setup.
import { h } from './ui.js';

const APP_URL = 'https://wouterstultiens.github.io/fogmeter/';

const section = (title, ...body) => h('div.card', h('h3', title), ...body);
const steps = (...items) => h('ol', { style: { margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' } }, ...items.map((i) => h('li', i)));
const code = (t) => h('pre.code', t);
const prompt = (text) => {
  const btn = h('button.link', { onclick: async () => {
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Gekopieerd'; } catch { btn.textContent = 'Kopiëren lukte niet: selecteer de tekst'; }
  } }, 'Kopieer prompt');
  return h('div', code(text), btn);
};

const LOG_PROMPT = `Create a shortcut named "Fogmeter log" that runs silently, without asking or showing anything:
1. Get the Current Date.
2. Format Date with a custom format: yyyy-MM-dd'T'HH:mm
3. Append to Text File: append the formatted date to the file fogmeter/use.log in the Shortcuts folder of iCloud Drive, with "Make New Line" on.
Nothing else: no notification, no output.`;

const OPEN_PROMPT = `Create a shortcut named "Fogmeter" that does this, in order:
1. Get File: fogmeter/use.log from the Shortcuts folder of iCloud Drive, with "Error If Not Found" off.
2. Get Text from that file, then URL Encode it. Save it in a variable called UseLog.
3. Find Health Samples where Type is Steps and Start Date is in the last 1 day. Calculate Statistics: Sum of those samples, then Round Number to whole numbers. Save it in a variable called Steps.
4. Text: ${APP_URL}?use=[UseLog]&steps=[Steps]  (insert the variables UseLog and Steps where the brackets are).
5. Save File: save the text "-" to fogmeter/use.log in the Shortcuts folder of iCloud Drive, with "Ask Where to Save" off and "Overwrite If File Exists" on. This empties the log for the next night.
6. Open URLs: open the text from step 4.
Add it to the Home Screen.`;

export function helpView() {
  return [
    section('Elke ochtend',
      steps(
        'Wekker → 5 min snoozen → opstaan, water, licht → 11 min mediteren.',
        'Open Fogmeter via de Shortcut op je beginscherm. Nog geen thee.',
        'Niet storen aan, stil plekje, telefoon altijd op dezelfde manier vast.',
        'Doe de sessie ook in het weekend. Consistentie is belangrijker dan een perfecte dag.',
        'Lukt een onderdeel niet (telefoontje, lawaai)? Tik op "Overslaan": onder de Start-knop, of rechtsboven tijdens de taak (twee keer tikken). Dat onderdeel telt die dag dan niet mee; de rest wel.',
      ),
      h('p.small.muted', 'De eerste 14 sessies zijn inwerken (je wordt vanzelf beter). Die worden gewoon bewaard en je ziet ze bij Resultaten → Ruwe scores. Daarna 28 dagen basislijn: verander dan nog niets. Daarna kun je experimenten doen.'),
    ),

    section('Notities (optioneel, wanneer je wilt)',
      h('p.small', 'Tik op "Notitie" op het startscherm als er iets is: een blanco moment op je werk, hoofdpijn, laat gegeten. Eventueel met een cijfer voor hoe helder je op dat moment bent. Kost ± 10 seconden.'),
      h('p.small.muted', 'De volgende ochtend staat je tekst al ingevuld in de notitie aan het eind van de sessie. Het cijfer wordt apart bewaard; de ochtendvraag over gisteren blijft zo elke dag dezelfde meting.'),
    ),

    section('Eenmalig: betere spraakherkenning',
      steps(
        'Instellingen → Algemeen → Toetsenbord → Dicteer aan (Safari gebruikt dezelfde dicteerfunctie).',
        'Zorg dat Nederlands als toetsenbord/dicteertaal aanstaat; op nieuwere iPhones wordt dan het Nederlandse model op het toestel geladen (sneller, beter, offline).',
        'Tijdens het opnoemen: wacht op het groene "Praat maar", zeg elk woord los met een korte pauze, telefoon ± 30 cm voor je gezicht, stille kamer.',
      ),
      h('p.small.muted', 'Hoort de app iets verkeerd, geen probleem: aan het eind zie je wat hij hoorde en vink je zelf aan wat klopt.'),
    ),

    section('Eenmalig: Safari',
      steps(
        'Instellingen → Apps → Safari → Microfoon → "Sta toe" (anders vraagt Safari elke dag om toestemming).',
        'Energiebesparingsmodus uit tijdens de test (die vertraagt het scherm en maakt reactietijden onbetrouwbaar).',
        'Gebruik de app via de Shortcut (die opent Safari). Zet de site níet daarnaast als losse app op je beginscherm: dat is een aparte opslag.',
      ),
    ),

    section('Eenmalig: Shortcuts (automatische slaaptijden + stappen)',
      h('p.small', 'De app leidt je slaaptijden af uit wanneer je je telefoon gebruikt: de laatste keer ’s avonds is "lichten uit", de eerste keer na 05:00 is "wakker". Een kort moment na 01:00 (op de klok kijken) telt als wakker liggen, niet als bedtijd. Klopt het een keer niet, tik dan op "Aanpassen".'),
      h('p', h('strong', '1. Opdracht "Fogmeter log"')),
      h('p.small', 'Plak in Opdrachten bij het maken van een opdracht met Apple Intelligence:'),
      prompt(LOG_PROMPT),
      h('p', h('strong', '2. Automatisering (met de hand, ± 1 min)')),
      steps(
        'Opdrachten → Automatisering → + → App.',
        'Kies Safari, Obsidian, Todoist en Klok. Vink "Is geopend" én "Is gesloten" aan.',
        '"Voer direct uit" aan, "Melding bij uitvoeren" uit → Volgende.',
        'Actie "Voer opdracht uit" → Fogmeter log.',
      ),
      h('p.small.muted', 'Kost vrijwel geen batterij: elke keer één regel tekst wegschrijven, een paar milliseconden.'),
      h('p', h('strong', '3. Opdracht "Fogmeter" (op je beginscherm)')),
      prompt(OPEN_PROMPT),
      h('p.small.muted', 'Eerste keer: geef toegang tot Gezondheid (stappen) en tot het bestand. De oude wekker- en oplader-automatiseringen voor wake.txt en bed.txt kun je verwijderen. Geen gegevens van de telefoon? Dan staat er 23:00 → 07:00 (aan te passen bij Instellingen).'),
    ),

    section('Eenmalig: back-up (privé GitHub-repo)',
      steps(
        'github.com → New repository → naam fogmeter-data → Private → Create.',
        'Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.',
        'Repository access: Only select repositories → fogmeter-data. Permissions → Contents: Read and write. Expiration: zo lang mogelijk (of geen).',
        'Kopieer het token en plak het in Fogmeter → Instellingen → Token. Tik "Test verbinding".',
      ),
      h('p.small.muted', 'Na elke sessie wordt de sessie automatisch geüpload (alleen scores en reactietijden, geen audio). Wist Safari ooit je gegevens, dan haalt de app ze terug uit de back-up zodra het token weer is ingevuld.'),
    ),

    section('Wat wordt gemeten',
      steps(
        'Woordenlijst: 12 woorden onthouden, direct en na ± 4 min (geheugen). Je zegt ze hardop; de app luistert en jij controleert aan het eind.',
        'Reactietest (3 min): aandacht en "wegvallers" (missers ≥ 355 ms). Reactietijden springen in stapjes van ± 17 ms (bv. 284, 301, 317): het scherm ververst 60 keer per seconde. Over de ± 50 tikken per sessie middelt dat uit.',
        'Symbolen: verwerkingssnelheid ("traag hoofd").',
        'Automatisch: tik-nauwkeurigheid (onhandigheid), tijd sinds wakker worden, en uit de spraakherkenning hoe snel je eerste woord komt en stiltes van meer dan 5 s.',
      ),
      h('p.small.muted', 'Testscores en hoe je je voelt worden apart bijgehouden: ze lopen vaak niet gelijk op, en beide zijn informatief.'),
    ),
  ];
}
