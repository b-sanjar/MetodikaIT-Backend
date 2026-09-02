export const EQUIPMENT_BASE = ['Kompyuter sinfi', 'Proyektor yoki interaktiv doska', 'Tarqatma materiallar']

export function objectiveFor(title: string, grade: number): string {
  return `O‘quvchilarga «${title}» mavzusini amaliy misollar orqali tushuntirish, ${grade}-sinf dasturiga mos nazariy bilim va amaliy ko‘nikmalarni shakllantirish.`
}

export function theoryFor(title: string): string[] {
  return [
    `Dars «${title}» mavzusiga bag‘ishlanadi. Kirish qismida o‘tgan dars takrorlanadi va yangi mavzu kundalik hayotdagi misollar bilan bog‘lab boshlanadi.`,
    'Asosiy tushunchalar doskada yoki taqdimotda bosqichma-bosqich ochib beriladi: ta’rif, asosiy xossalar va qo‘llanish sohalari. Har bir tushuncha kamida bitta jonli misol bilan mustahkamlanadi.',
    'Namoyish qismida o‘qituvchi mavzuga oid amaliy jarayonni proyektor orqali ko‘rsatadi, o‘quvchilar esa asosiy qadamlarni daftarga qayd etib boradi.',
    'Yakunida savol-javob o‘tkaziladi: o‘quvchilar mavzu bo‘yicha 2–3 nazorat savoliga og‘zaki javob beradi va tushunmagan joylari aniqlanadi.',
  ]
}

export function practiceFor(title: string): string[] {
  return [
    `«${title}» mavzusi bo‘yicha o‘qituvchi ko‘rsatgan amallarni kompyuterda mustaqil takrorlash.`,
    'Juftlikda ishlash: tarqatma materialdagi topshiriqni bajarish va natijani sinfdoshi bilan solishtirish.',
    'Mustaqil topshiriq: mavzuga oid kichik masalani yechish va natijani o‘qituvchiga ko‘rsatish.',
  ]
}

export function homeworkFor(title: string): string {
  return `«${title}» mavzusi bo‘yicha daftardagi konspektni o‘qib kelish va mavzuga oid 3 ta misolni mustaqil bajarish. Qo‘shimcha: mavzu yuzasidan bitta savol tayyorlab kelish.`
}

export function outcomesFor(title: string): string[] {
  return [
    `«${title}» mavzusidagi asosiy tushunchalarni ta’riflay oladi`,
    'Mavzuga oid amaliy topshiriqni mustaqil bajara oladi',
    'Olingan bilimni kundalik misollar bilan bog‘lay oladi',
  ]
}

export const RICH_LESSONS: Record<
  string,
  {
    objective: string
    theory: string[]
    practice: string[]
    homework: string
    outcomes: string[]
    equipment: string[]
  }
> = {
  '5-1-1': {
    objective:
      'O‘quvchilarga informatika fani, axborot tushunchasi va kompyuter xonasida xavfsizlik qoidalarini o‘rgatish; fanga qiziqish uyg‘otish.',
    theory: [
      'Informatika — axborotni to‘plash, saqlash, qayta ishlash va uzatish usullarini o‘rganuvchi fan. «Axborot» so‘zi arabcha «xabar» so‘zidan olingan bo‘lib, atrof-muhitdan olinadigan barcha ma’lumotlarni anglatadi.',
      'Axborot turlari: matnli (kitob, xat), tasviriy (rasm, chizma), tovushli (musiqa, nutq), raqamli (baholar, telefon raqami). Biz axborotni 5 ta sezgi a’zolarimiz orqali qabul qilamiz, ularning eng kattasi — ko‘rish (80% dan ortiq).',
      'Kompyuter xonasida xavfsizlik: tok simlariga tegmaslik, kompyuter oldida to‘g‘ri o‘tirish (masofa 50–60 sm), xonada yugurmaslik va ovqatlanmaslik.',
      'Yakunida «Informatika bizga nima uchun kerak?» mavzusida 3 daqiqalik erkin suhbat o‘tkaziladi va fanning yillik yo‘l xaritasi (choraklar bo‘yicha) taqdimotda ko‘rsatiladi.',
    ],
    practice: [
      'Sinf ikki guruhga bo‘linadi: har bir guruh 5 ta kundalik axborot misolini topib, turini (matn, tasvir, tovush, son) aniqlaydi.',
      'Ish o‘rnini to‘g‘ri tashkil qilish mashqi: har bir o‘quvchi o‘z kompyuteri oldida to‘g‘ri o‘tirish holatini ko‘rsatadi.',
      'Xavfsizlik qoidalari bo‘yicha «To‘g‘ri yoki noto‘g‘ri» o‘yini: o‘qituvchi vaziyat aytadi, o‘quvchilar kartochka ko‘taradi.',
    ],
    homework:
      'Uyda oila a’zolaridan qanday axborot manbalaridan foydalanishini so‘rab, kamida 5 ta misolni daftarga yozib kelish. Har bir misol qarshisiga axborot turini belgilash.',
    outcomes: [
      'Informatika fanining o‘rganish obyektini ta’riflay oladi',
      'Axborot turlarini kundalik misollarda ajrata oladi',
      'Kompyuter xonasida xavfsiz ishlash qoidalariga amal qiladi',
    ],
    equipment: ['Kompyuter sinfi', 'Proyektor', 'Xavfsizlik qoidalari plakati', '«To‘g‘ri/Noto‘g‘ri» kartochkalari'],
  },
  '7-2-1': {
    objective:
      'O‘quvchilarni Python dasturlash tili, uning imkoniyatlari va ishlab chiqish muhiti bilan tanishtirish; birinchi dasturni yozish va ishga tushirish ko‘nikmasini shakllantirish.',
    theory: [
      'Python — o‘qilishi oson, keng qo‘llaniladigan dasturlash tili. U sun’iy intellekt, veb-saytlar, o‘yinlar va ilmiy hisob-kitoblarda ishlatilishi haqiqiy mahsulotlar misolida (YouTube, Instagram) ko‘rsatiladi.',
      'Dasturlash muhiti bilan tanishuv: IDLE yoki onlayn muhit (replit) ochiladi, kod oynasi va natija oynasi farqi tushuntiriladi.',
      'Birinchi dastur an’anaviy print("Salom, dunyo!") misolida yoziladi. print() funksiyasining vazifasi, qavslar va qo‘shtirnoqlarning ahamiyati alohida ta’kidlanadi.',
      'Sintaksis xatolar bilan tanishuv: qo‘shtirnoq tushirib qoldirilsa nima bo‘lishini o‘qituvchi ataylab ko‘rsatadi — xato xabarini o‘qish ham dasturchining muhim ko‘nikmasi ekani aytiladi.',
    ],
    practice: [
      'print() yordamida o‘z ismi va maktab nomini ekranga chiqaruvchi dastur yozish.',
      'Uch qatorli «vizitka» dasturi: ism, sinf, sevimli fan — har biri alohida print() bilan.',
      'Ataylab buzilgan 3 ta kod namunasidagi xatolarni topib to‘g‘rilash (qo‘shtirnoq, qavs, imlo).',
    ],
    homework:
      'print() funksiyasidan foydalanib, o‘zi haqida 5 qatorli ma’lumot chiqaruvchi dastur yozib kelish. Qo‘shimcha: Python ishlatilgan 3 ta mashhur mahsulotni internetdan topish.',
    outcomes: [
      'Python tilining qo‘llanish sohalarini sanab bera oladi',
      'Dasturlash muhitida yangi fayl yaratib, dasturni ishga tushira oladi',
      'print() funksiyasi bilan ekranga ma’lumot chiqara oladi va oddiy sintaksis xatoni topa oladi',
    ],
    equipment: ['Kompyuter sinfi (Python o‘rnatilgan)', 'Proyektor', 'Xato kod namunalari tarqatmasi'],
  },
  '5-3-1': {
    objective:
      'Algoritm tushunchasini kundalik hayot misollari orqali shakllantirish, algoritmning asosiy xossalarini (aniqlik, tugallanganlik, natijaviylik) tushuntirish.',
    theory: [
      'Dars «Choy damlash» misolidan boshlanadi: o‘quvchilar jarayonni qadamlarga bo‘lib aytadi, o‘qituvchi doskaga yozadi. Shu tariqa algoritm — maqsadga erishish uchun bajariladigan aniq qadamlar ketma-ketligi ekani ochib beriladi.',
      'Algoritm xossalari misollar bilan ko‘riladi: aniqlik (har bir qadam bir ma’noli), tugallanganlik (qadamlar soni chekli), natijaviylik (oxirida natija bo‘lishi shart).',
      'Noto‘g‘ri tuzilgan algoritm misoli tahlil qilinadi: qadamlar o‘rni almashtirilsa (choyni damlab, keyin suv qaynatish) natija buzilishi ko‘rsatiladi.',
      'Ijrochi tushunchasi kiritiladi: odam, robot, kompyuter — har bir ijrochining o‘z buyruqlar tizimi bo‘lishi tushuntiriladi.',
    ],
    practice: [
      '«Maktabga kelish» algoritmini 6–8 qadamda daftarga yozish va juftlikda tekshirish.',
      'Aralashtirib berilgan qadamlarni to‘g‘ri tartibga keltirish (tarqatma kartochkalar bilan).',
      '«Robot-ijrochi» o‘yini: bir o‘quvchi buyruq beradi, ikkinchisi faqat aytilganini bajaradi — aniq bo‘lmagan buyruqlar muammosi jonli ko‘rinadi.',
    ],
    homework:
      'Uyda biror kundalik ish (masalan, nonushta tayyorlash) algoritmini kamida 8 qadamda yozib kelish va algoritm xossalariga mosligini tekshirish.',
    outcomes: [
      'Algoritm tushunchasiga ta’rif bera oladi va kundalik misol keltira oladi',
      'Algoritmning uchta asosiy xossasini tushuntira oladi',
      'Berilgan qadamlarni to‘g‘ri ketma-ketlikka joylashtira oladi',
    ],
    equipment: ['Proyektor', 'Qadam-kartochkalar to‘plami', 'Doska va markerlar'],
  },
}
