export type ProfileQuestion = {
  key: string;
  label: string;
};

export const PROFILE_QUESTIONS: ProfileQuestion[] = [
  { key: 'smokeFree', label: 'Je suis non-fumeur' },
  { key: 'acceptsPets', label: "J'accepte les animaux" },
  { key: 'likesConversation', label: "J'aime discuter pendant le trajet" },
  { key: 'musicOk', label: 'La musique est bienvenue' },
  { key: 'luggageSpace', label: "J'ai de la place pour les bagages" },
  { key: 'acOk', label: 'Climatisation disponible' },
];

export const PROFILE_QUESTION_KEYS = new Set(PROFILE_QUESTIONS.map((question) => question.key));
