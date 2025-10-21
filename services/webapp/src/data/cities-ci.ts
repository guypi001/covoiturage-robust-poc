// Liste de base — complète-la librement
export const CI_CITIES = [
  "Abidjan","Yamoussoukro","Bouaké","Daloa","San-Pédro","Korhogo","Man","Gagnoa",
  "Abengourou","Divo","Anyama","Soubré","Agboville","Séguéla","Bondoukou","Odienné",
  "Ferkessédougou","Grand-Bassam","Bingerville","Aboisso","Tiassalé","Bouaflé","Issia",
  "Toumodi","Dimbokro","Lakota","Adzopé","Dabou","Daoukro","Tanda","Sassandra","Tabou",
  "Guiglo","Duékoué","Zouan-Hounien","Boundiali","Sinfra","Oumé","Méagui","Vavoua",
  "Tengréla","Katiola","Arrah","Bouna","Mankono","Touba",
].filter((v, i, a) => a.indexOf(v) === i); // uniq (au cas où)
