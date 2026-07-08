-- =============================================
--  SCHEMA: OWN QUESTIONÁRIOS
-- =============================================

-- 1. Tabela de Questionários
CREATE TABLE IF NOT EXISTS barber_questionnaires (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Perguntas
CREATE TABLE IF NOT EXISTS questionnaire_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  questionnaire_id UUID REFERENCES barber_questionnaires(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rating', 'multiple_choice', 'text')),
  options JSONB, -- Armazena opções para múltipla escolha, ex: ["Excelente", "Bom", "Regular"]
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de Respostas (Cabeçalho da Submissão)
CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  questionnaire_id UUID REFERENCES barber_questionnaires(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES previa_barbers(id) ON DELETE CASCADE,
  barber_name TEXT NOT NULL, -- Preserva o nome do barbeiro no momento da resposta
  unit_name TEXT NOT NULL, -- Preserva o nome da unidade no momento da resposta
  answered_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(questionnaire_id, barber_id) -- Garante que um barbeiro só responda uma vez por questionário
);

-- 4. Tabela de Respostas Individuais (Perguntas/Valores)
CREATE TABLE IF NOT EXISTS questionnaire_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id UUID REFERENCES questionnaire_responses(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questionnaire_questions(id) ON DELETE CASCADE,
  answer_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS (Row Level Security)
ALTER TABLE barber_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_answers ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Leitura Todos - Questionários" ON barber_questionnaires FOR SELECT USING (true);
CREATE POLICY "Leitura Todos - Perguntas" ON questionnaire_questions FOR SELECT USING (true);
CREATE POLICY "Leitura Todos - Respostas" ON questionnaire_responses FOR SELECT USING (true);
CREATE POLICY "Leitura Todos - Respostas Detalhadas" ON questionnaire_answers FOR SELECT USING (true);

CREATE POLICY "Modify Todos - Questionários" ON barber_questionnaires FOR ALL USING (true);
CREATE POLICY "Modify Todos - Perguntas" ON questionnaire_questions FOR ALL USING (true);
CREATE POLICY "Modify Todos - Respostas" ON questionnaire_responses FOR ALL USING (true);
CREATE POLICY "Modify Todos - Respostas Detalhadas" ON questionnaire_answers FOR ALL USING (true);
