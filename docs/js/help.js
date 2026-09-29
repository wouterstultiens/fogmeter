// In-app instructions (Dutch): daily routine, iOS Shortcut setup, backup setup.
import { h } from './ui.js';

const APP_URL = 'https://wouterstultiens.github.io/fogmeter/';

const section = (title, ...body) => h('div.card', h('h3', title), ...body);
const steps = (...items) => h('ol', { style: { margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' } }, ...items.map((i) => h('li', i)));
const code = (t) => h('pre.code', t);

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

    section('Eenmalig: Shortcuts (automatische wektijd + stappen)',
      h('p.small', 'Twee onderdelen in de app Opdrachten (Shortcuts). Namen van acties kunnen iets verschillen; zoek ze op naam.'),
      h('p', h('strong', 'A. Automatisering: wektijd vastleggen')),
      steps(
        'Opdrachten → Automatisering → + → Wekker → "Wordt gestopt" → Elke wekker (of je ochtendwekker) → Voer direct uit.',
        'Actie "Datum" (Huidige datum) → actie "Formatteer datum": Aangepast, notatie:',
        code("yyyy-MM-dd'T'HH:mm"),
        'Actie "Bewaar bestand": invoer = geformatteerde datum, "Vraag waar" uit, pad:',
        code('fogmeter/wake.txt'),
        '"Vervang bestaande bestanden" aan.',
      ),
      h('p', h('strong', 'B. Opdracht "Fogmeter" (op je beginscherm)')),
      steps(
        'Nieuwe opdracht, naam "Fogmeter".',
        'Actie "Haal bestand op" (Get File): pad fogmeter/wake.txt, "Fout als niet gevonden" uit. Zet in variabele Wake.',
        'Actie "Zoek gezondheidsvoorbeelden" (Find Health Samples): Type = Stappen, Begindatum = in de afgelopen 1 dagen.',
        'Actie "Bereken statistieken": Som → daarna "Rond getal af". Zet in variabele Steps.',
        'Actie "Tekst" met (variabelen invoegen op de plek van [ ]):',
        code(`${APP_URL}?wake=[Wake]&steps=[Steps]`),
        'Actie "Open URL\'s" met die tekst.',
        'Deel → Zet op beginscherm. Eerste keer: geef toegang tot Gezondheid (stappen).',
      ),
      h('p', h('strong', 'C. Automatisering: bedtijd (laatste keer wekker zetten)')),
      h('p.small', 'iOS heeft geen trigger voor "wekker gezet". Daarom: elke keer dat je de Klok-app sluit, wordt de tijd bijgeschreven. De app neemt als bedtijd de laatste tijd tussen 20:00 en 04:00 van afgelopen nacht; overdag en \'s ochtends tellen niet mee.'),
      steps(
        'Opdrachten → Automatisering → + → App → Klok → alleen "Is gesloten" → Voer direct uit.',
        'Actie "Datum" (Huidige datum) → actie "Formatteer datum": Aangepast, notatie:',
        code("yyyy-MM-dd'T'HH:mm"),
        'Actie "Voeg toe aan tekstbestand" (Append to Text File): invoer = geformatteerde datum, "Nieuwe regel" aan, pad:',
        code('fogmeter/bed.txt'),
        'In opdracht B: na "Haal bestand op" voor wake.txt nog een "Haal bestand op" voor fogmeter/bed.txt ("Fout als niet gevonden" uit) → actie "Codeer URL" → zet in variabele Bed.',
        'Maak de tekst in B:',
        code(`${APP_URL}?wake=[Wake]&bed=[Bed]&steps=[Steps]`),
      ),
      h('p.small.muted', 'Zet je de wekker via Siri of vanaf het toegangsscherm (zonder de Klok-app te openen), dan wordt die keer niet vastgelegd. Het bestand groeit met een regel per keer; je mag het gerust af en toe weggooien.'),
      h('p.small.muted', 'Werkt de Shortcut niet? Dan vul je de tijden gewoon zelf in (vooringevuld met gisteren).'),
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
