/** Dados do consultório usados em confirmações, site e e-mails. */
export const PRACTICE = {
  psychologistName: 'Renata Batista',
  practiceName: 'Renata Batista — Psicologia & Arteterapia',
  crp: 'CRP 06/145801',
  phoneDisplay: '(11) 99278-9380',
  phoneE164: '5511992789380',
  email: 'contato@renatapsicoarte.com.br',
  address: 'R. Dr. Aureliano Barreiros, 641 — Itaquera, São Paulo — SP, 08210-450',
  addressHtml: 'R. Dr. Aureliano Barreiros, 641<br>Itaquera, São Paulo — SP, 08210-450',
  hours: 'Seg–Sex: 8h às 20h · Sáb: 9h às 14h',
};

export function getOnlineMeetingLink() {
  return (process.env.ONLINE_MEETING_LINK || '').trim() || null;
}

export function getPublicPractice() {
  const email = (process.env.PRACTICE_EMAIL || '').trim() || PRACTICE.email;
  const hours = (process.env.PRACTICE_HOURS || '').trim() || PRACTICE.hours;
  return {
    psychologistName: PRACTICE.psychologistName,
    practiceName: PRACTICE.practiceName,
    crp: PRACTICE.crp,
    phoneDisplay: PRACTICE.phoneDisplay,
    phoneE164: PRACTICE.phoneE164,
    email,
    address: PRACTICE.address,
    hours,
    onlineAvailable: Boolean(getOnlineMeetingLink()),
    whatsappUrl: `https://wa.me/${PRACTICE.phoneE164}`,
  };
}
