export interface Unit {
  id: string;
  name: string;
  created_at?: string;
}

export interface Barber {
  id: string;
  unit_id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
}

export interface Questionnaire {
  id: string;
  title: string;
  description: string;
  is_active: boolean;
  is_anonymous?: boolean;
  created_at?: string;
  questions?: Question[];
}

export type QuestionType = 'rating' | 'multiple_choice' | 'text';

export interface QuestionOption {
  text: string;
  requireJustification?: boolean;
}

export interface Question {
  id: string;
  questionnaire_id: string;
  text: string;
  type: QuestionType;
  options?: (string | QuestionOption)[] | null;
  sort_order: number;
}

export interface QuestionnaireResponse {
  id: string;
  questionnaire_id: string;
  barber_id: string;
  barber_name: string;
  unit_name: string;
  answered_at: string;
  answers?: Answer[];
}

export interface Answer {
  id: string;
  response_id: string;
  question_id: string;
  answer_value: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}
