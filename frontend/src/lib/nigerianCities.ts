export type NigerianCity = { city: string; state: string };

export const NIGERIAN_CITIES: NigerianCity[] = [
  // ── Lagos ──────────────────────────────────────────────────────────────────
  { city: "Lagos Island",  state: "Lagos" },
  { city: "Ikeja",         state: "Lagos" },
  { city: "Victoria Island", state: "Lagos" },
  { city: "Lekki",         state: "Lagos" },
  { city: "Surulere",      state: "Lagos" },
  { city: "Yaba",          state: "Lagos" },
  { city: "Apapa",         state: "Lagos" },
  { city: "Agege",         state: "Lagos" },
  { city: "Mushin",        state: "Lagos" },
  { city: "Oshodi",        state: "Lagos" },
  { city: "Alimosho",      state: "Lagos" },
  { city: "Badagry",       state: "Lagos" },
  { city: "Epe",           state: "Lagos" },
  { city: "Ikorodu",       state: "Lagos" },
  { city: "Maryland",      state: "Lagos" },
  { city: "Ojota",         state: "Lagos" },
  { city: "Gbagada",       state: "Lagos" },
  { city: "Festac Town",   state: "Lagos" },
  { city: "Isale Eko",     state: "Lagos" },
  { city: "Alaba",         state: "Lagos" },
  { city: "Trade Fair",    state: "Lagos" },
  { city: "Ojodu",         state: "Lagos" },
  { city: "Berger",        state: "Lagos" },
  { city: "Sangotedo",     state: "Lagos" },
  { city: "Ajah",          state: "Lagos" },
  { city: "Ojo",           state: "Lagos" },
  { city: "Amuwo-Odofin",  state: "Lagos" },

  // ── FCT / Abuja ────────────────────────────────────────────────────────────
  { city: "Abuja",         state: "FCT" },
  { city: "Garki",         state: "FCT" },
  { city: "Maitama",       state: "FCT" },
  { city: "Wuse",          state: "FCT" },
  { city: "Gwarinpa",      state: "FCT" },
  { city: "Kubwa",         state: "FCT" },
  { city: "Lugbe",         state: "FCT" },
  { city: "Kuje",          state: "FCT" },
  { city: "Gwagwalada",    state: "FCT" },
  { city: "Bwari",         state: "FCT" },
  { city: "Nyanya",        state: "FCT" },
  { city: "Karu",          state: "FCT" },
  { city: "Jabi",          state: "FCT" },
  { city: "Utako",         state: "FCT" },
  { city: "Central Area",  state: "FCT" },

  // ── Rivers ─────────────────────────────────────────────────────────────────
  { city: "Port Harcourt", state: "Rivers" },
  { city: "Obio-Akpor",   state: "Rivers" },
  { city: "Bonny",         state: "Rivers" },
  { city: "Eleme",         state: "Rivers" },
  { city: "Rumuola",       state: "Rivers" },
  { city: "Rumuola",       state: "Rivers" },
  { city: "D-Line",        state: "Rivers" },
  { city: "GRA",           state: "Rivers" },
  { city: "Oyigbo",        state: "Rivers" },
  { city: "Omoku",         state: "Rivers" },

  // ── Kano ───────────────────────────────────────────────────────────────────
  { city: "Kano",          state: "Kano" },
  { city: "Nassarawa",     state: "Kano" },
  { city: "Dala",          state: "Kano" },
  { city: "Fagge",         state: "Kano" },
  { city: "Gwale",         state: "Kano" },
  { city: "Kumbotso",      state: "Kano" },
  { city: "Tarauni",       state: "Kano" },
  { city: "Ungogo",        state: "Kano" },

  // ── Oyo ────────────────────────────────────────────────────────────────────
  { city: "Ibadan",        state: "Oyo" },
  { city: "Ogbomosho",     state: "Oyo" },
  { city: "Oyo",           state: "Oyo" },
  { city: "Iseyin",        state: "Oyo" },
  { city: "Eruwa",         state: "Oyo" },
  { city: "Molete",        state: "Oyo" },
  { city: "Challenge",     state: "Oyo" },
  { city: "Ring Road",     state: "Oyo" },

  // ── Anambra ────────────────────────────────────────────────────────────────
  { city: "Onitsha",       state: "Anambra" },
  { city: "Awka",          state: "Anambra" },
  { city: "Nnewi",         state: "Anambra" },
  { city: "Ekwulobia",     state: "Anambra" },
  { city: "Ogidi",         state: "Anambra" },
  { city: "Oba",           state: "Anambra" },
  { city: "Obosi",         state: "Anambra" },
  { city: "Agulu",         state: "Anambra" },
  { city: "Ihiala",        state: "Anambra" },

  // ── Imo ────────────────────────────────────────────────────────────────────
  { city: "Owerri",        state: "Imo" },
  { city: "Orlu",          state: "Imo" },
  { city: "Okigwe",        state: "Imo" },
  { city: "Oguta",         state: "Imo" },
  { city: "Mbaise",        state: "Imo" },

  // ── Abia ───────────────────────────────────────────────────────────────────
  { city: "Aba",           state: "Abia" },
  { city: "Umuahia",       state: "Abia" },
  { city: "Ohafia",        state: "Abia" },
  { city: "Ariaria",       state: "Abia" },

  // ── Delta ──────────────────────────────────────────────────────────────────
  { city: "Warri",         state: "Delta" },
  { city: "Asaba",         state: "Delta" },
  { city: "Effurun",       state: "Delta" },
  { city: "Sapele",        state: "Delta" },
  { city: "Ughelli",       state: "Delta" },
  { city: "Agbor",         state: "Delta" },
  { city: "Abraka",        state: "Delta" },

  // ── Edo ────────────────────────────────────────────────────────────────────
  { city: "Benin City",    state: "Edo" },
  { city: "Auchi",         state: "Edo" },
  { city: "Ekpoma",        state: "Edo" },
  { city: "Uromi",         state: "Edo" },
  { city: "Igarra",        state: "Edo" },
  { city: "Okpella",       state: "Edo" },

  // ── Cross River ────────────────────────────────────────────────────────────
  { city: "Calabar",       state: "Cross River" },
  { city: "Ikom",          state: "Cross River" },
  { city: "Ugep",          state: "Cross River" },
  { city: "Ogoja",         state: "Cross River" },

  // ── Akwa Ibom ──────────────────────────────────────────────────────────────
  { city: "Uyo",           state: "Akwa Ibom" },
  { city: "Eket",          state: "Akwa Ibom" },
  { city: "Ikot Ekpene",   state: "Akwa Ibom" },
  { city: "Oron",          state: "Akwa Ibom" },

  // ── Enugu ──────────────────────────────────────────────────────────────────
  { city: "Enugu",         state: "Enugu" },
  { city: "Nsukka",        state: "Enugu" },
  { city: "Agbani",        state: "Enugu" },
  { city: "Oji River",     state: "Enugu" },
  { city: "Awgu",          state: "Enugu" },

  // ── Ebonyi ─────────────────────────────────────────────────────────────────
  { city: "Abakaliki",     state: "Ebonyi" },
  { city: "Afikpo",        state: "Ebonyi" },
  { city: "Onueke",        state: "Ebonyi" },

  // ── Kaduna ─────────────────────────────────────────────────────────────────
  { city: "Kaduna",        state: "Kaduna" },
  { city: "Zaria",         state: "Kaduna" },
  { city: "Kafanchan",     state: "Kaduna" },
  { city: "Saminaka",      state: "Kaduna" },

  // ── Katsina ────────────────────────────────────────────────────────────────
  { city: "Katsina",       state: "Katsina" },
  { city: "Daura",         state: "Katsina" },
  { city: "Funtua",        state: "Katsina" },
  { city: "Dutsin-Ma",     state: "Katsina" },

  // ── Sokoto ─────────────────────────────────────────────────────────────────
  { city: "Sokoto",        state: "Sokoto" },
  { city: "Bodinga",       state: "Sokoto" },
  { city: "Illela",        state: "Sokoto" },

  // ── Niger ──────────────────────────────────────────────────────────────────
  { city: "Minna",         state: "Niger" },
  { city: "Bida",          state: "Niger" },
  { city: "Kontagora",     state: "Niger" },
  { city: "Suleja",        state: "Niger" },
  { city: "Lapai",         state: "Niger" },

  // ── Kwara ──────────────────────────────────────────────────────────────────
  { city: "Ilorin",        state: "Kwara" },
  { city: "Offa",          state: "Kwara" },
  { city: "Jebba",         state: "Kwara" },
  { city: "Omu-Aran",      state: "Kwara" },

  // ── Osun ───────────────────────────────────────────────────────────────────
  { city: "Osogbo",        state: "Osun" },
  { city: "Ile-Ife",       state: "Osun" },
  { city: "Ilesa",         state: "Osun" },
  { city: "Ede",           state: "Osun" },
  { city: "Iwo",           state: "Osun" },

  // ── Ogun ───────────────────────────────────────────────────────────────────
  { city: "Abeokuta",      state: "Ogun" },
  { city: "Sagamu",        state: "Ogun" },
  { city: "Ijebu-Ode",     state: "Ogun" },
  { city: "Ota",           state: "Ogun" },
  { city: "Sango-Ota",     state: "Ogun" },
  { city: "Mowe",          state: "Ogun" },
  { city: "Ibafo",         state: "Ogun" },
  { city: "Ilaro",         state: "Ogun" },

  // ── Ondo ───────────────────────────────────────────────────────────────────
  { city: "Akure",         state: "Ondo" },
  { city: "Ondo City",     state: "Ondo" },
  { city: "Owo",           state: "Ondo" },
  { city: "Okitipupa",     state: "Ondo" },
  { city: "Ile-Oluji",     state: "Ondo" },

  // ── Ekiti ──────────────────────────────────────────────────────────────────
  { city: "Ado-Ekiti",     state: "Ekiti" },
  { city: "Ikere",         state: "Ekiti" },
  { city: "Ijero",         state: "Ekiti" },
  { city: "Emure",         state: "Ekiti" },

  // ── Benue ──────────────────────────────────────────────────────────────────
  { city: "Makurdi",       state: "Benue" },
  { city: "Gboko",         state: "Benue" },
  { city: "Otukpo",        state: "Benue" },
  { city: "Katsina-Ala",   state: "Benue" },
  { city: "Yandev",        state: "Benue" },

  // ── Plateau ────────────────────────────────────────────────────────────────
  { city: "Jos",           state: "Plateau" },
  { city: "Bukuru",        state: "Plateau" },
  { city: "Shendam",       state: "Plateau" },
  { city: "Pankshin",      state: "Plateau" },

  // ── Nasarawa ───────────────────────────────────────────────────────────────
  { city: "Lafia",         state: "Nasarawa" },
  { city: "Keffi",         state: "Nasarawa" },
  { city: "Akwanga",       state: "Nasarawa" },
  { city: "Nasarawa",      state: "Nasarawa" },

  // ── Kogi ───────────────────────────────────────────────────────────────────
  { city: "Lokoja",        state: "Kogi" },
  { city: "Ankpa",         state: "Kogi" },
  { city: "Idah",          state: "Kogi" },
  { city: "Okene",         state: "Kogi" },
  { city: "Kabba",         state: "Kogi" },
  { city: "Anyigba",       state: "Kogi" },

  // ── Zamfara ────────────────────────────────────────────────────────────────
  { city: "Gusau",         state: "Zamfara" },
  { city: "Talata-Mafara", state: "Zamfara" },
  { city: "Kaura Namoda",  state: "Zamfara" },

  // ── Kebbi ──────────────────────────────────────────────────────────────────
  { city: "Birnin Kebbi",  state: "Kebbi" },
  { city: "Argungu",       state: "Kebbi" },
  { city: "Yauri",         state: "Kebbi" },

  // ── Jigawa ─────────────────────────────────────────────────────────────────
  { city: "Dutse",         state: "Jigawa" },
  { city: "Hadejia",       state: "Jigawa" },
  { city: "Gumel",         state: "Jigawa" },

  // ── Yobe ───────────────────────────────────────────────────────────────────
  { city: "Damaturu",      state: "Yobe" },
  { city: "Potiskum",      state: "Yobe" },
  { city: "Nguru",         state: "Yobe" },

  // ── Borno ──────────────────────────────────────────────────────────────────
  { city: "Maiduguri",     state: "Borno" },
  { city: "Biu",           state: "Borno" },
  { city: "Gwoza",         state: "Borno" },
  { city: "Konduga",       state: "Borno" },

  // ── Adamawa ────────────────────────────────────────────────────────────────
  { city: "Yola",          state: "Adamawa" },
  { city: "Mubi",          state: "Adamawa" },
  { city: "Numan",         state: "Adamawa" },
  { city: "Ganye",         state: "Adamawa" },

  // ── Taraba ─────────────────────────────────────────────────────────────────
  { city: "Jalingo",       state: "Taraba" },
  { city: "Wukari",        state: "Taraba" },
  { city: "Bali",          state: "Taraba" },

  // ── Gombe ──────────────────────────────────────────────────────────────────
  { city: "Gombe",         state: "Gombe" },
  { city: "Dukku",         state: "Gombe" },
  { city: "Kaltungo",      state: "Gombe" },

  // ── Bauchi ─────────────────────────────────────────────────────────────────
  { city: "Bauchi",        state: "Bauchi" },
  { city: "Azare",         state: "Bauchi" },
  { city: "Misau",         state: "Bauchi" },
  { city: "Katagum",       state: "Bauchi" },

  // ── Bayelsa ────────────────────────────────────────────────────────────────
  { city: "Yenagoa",       state: "Bayelsa" },
  { city: "Brass",         state: "Bayelsa" },
  { city: "Ogbia",         state: "Bayelsa" },
  { city: "Sagbama",       state: "Bayelsa" },
];

export function searchCities(query: string, limit = 8): NigerianCity[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  const seen = new Set<string>();
  const results: NigerianCity[] = [];
  for (const entry of NIGERIAN_CITIES) {
    const key = `${entry.city}|${entry.state}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (
      entry.city.toLowerCase().includes(q) ||
      entry.state.toLowerCase().includes(q)
    ) {
      results.push(entry);
      if (results.length >= limit) break;
    }
  }
  return results;
}
