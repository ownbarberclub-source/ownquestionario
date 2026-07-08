import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Unit, Barber, Questionnaire } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ArrowRight, ArrowLeft, Star, Send, ShieldAlert, Award } from 'lucide-react';
import logoImg from '../assets/logo.png';

export function BarberPortal() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [activeQuestionnaire, setActiveQuestionnaire] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(true);

  // Fluxo de identificação do Barbeiro
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [selectedBarber, setSelectedBarber] = useState<string>('');
  const [isIdentified, setIsIdentified] = useState(false);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);

  // Fluxo das Perguntas
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [justificationText, setJustificationText] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadPortalData();
  }, []);

  const loadPortalData = async () => {
    try {
      setLoading(true);
      // Carregar unidades
      const { data: unitsData } = await supabase.from('previa_units').select('*').order('name');
      if (unitsData) setUnits(unitsData);

      // Carregar barbeiros ativos
      const { data: barbersData } = await supabase
        .from('previa_barbers')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (barbersData) setBarbers(barbersData);

      // Carregar questionário ativo com suas perguntas
      const { data: questData } = await supabase
        .from('barber_questionnaires')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (questData) {
        // Se for anônimo, verificar localStorage para duplicidade antes de buscar perguntas
        if (questData.is_anonymous) {
          const answeredLocal = localStorage.getItem(`answered_${questData.id}`);
          if (answeredLocal) {
            setAlreadyAnswered(true);
          }
        }

        // Buscar perguntas do questionário
        const { data: questionsData } = await supabase
          .from('questionnaire_questions')
          .select('*')
          .eq('questionnaire_id', questData.id)
          .order('sort_order', { ascending: true });

        setActiveQuestionnaire({
          ...questData,
          questions: questionsData || []
        });
      }
    } catch (err) {
      console.error('Erro ao carregar dados do portal:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredBarbers = barbers.filter(b => b.unit_id === selectedUnit);

  const handleStartQuestionnaire = async () => {
    if (!selectedUnit || !selectedBarber || !activeQuestionnaire) return;

    try {
      setLoading(true);
      const { data } = await supabase
        .from('questionnaire_responses')
        .select('id')
        .eq('questionnaire_id', activeQuestionnaire.id)
        .eq('barber_id', selectedBarber)
        .maybeSingle();

      if (data) {
        setAlreadyAnswered(true);
      } else {
        setIsIdentified(true);
      }
    } catch (err) {
      console.error('Erro ao validar resposta duplicada:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper para normalizar estrutura de opções (Retrocompatibilidade)
  const getOptionInfo = (opt: any): { text: string; requireJustification: boolean } => {
    if (!opt) return { text: '', requireJustification: false };
    if (typeof opt === 'string') {
      return { text: opt, requireJustification: false };
    }
    return {
      text: opt.text || '',
      requireJustification: !!opt.requireJustification
    };
  };

  const questions = activeQuestionnaire?.questions || [];
  const currentQuestion = questions[currentStep];

  // Efeito para restaurar justificativa se o usuário voltar para uma pergunta já respondida
  useEffect(() => {
    if (currentQuestion && answers[currentQuestion.id]) {
      const fullAnswer = answers[currentQuestion.id];
      if (currentQuestion.type === 'multiple_choice' && fullAnswer.includes(' | Justificativa: ')) {
        const [optText, justText] = fullAnswer.split(' | Justificativa: ');
        setAnswers(prev => ({ ...prev, [currentQuestion.id]: optText }));
        setJustificationText(justText || '');
      } else {
        setJustificationText('');
      }
    } else {
      setJustificationText('');
    }
  }, [currentStep, currentQuestion?.id]);

  const handleAnswerSelect = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
    // Resetar a justificativa ao mudar a opção
    setJustificationText('');
  };

  const isCurrentStepValid = () => {
    if (!currentQuestion) return false;
    const answer = answers[currentQuestion.id];
    if (!answer) return false;

    if (currentQuestion.type === 'multiple_choice') {
      const selectedOption = currentQuestion.options?.find(opt => getOptionInfo(opt).text === answer);
      const info = getOptionInfo(selectedOption);
      if (info.requireJustification && !justificationText.trim()) {
        return false;
      }
    }

    if (currentQuestion.type === 'text' && !answer.trim()) {
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (!currentQuestion || !isCurrentStepValid()) return;

    // Atualiza estado local compilando a justificativa
    const answer = answers[currentQuestion.id];
    const selectedOption = currentQuestion.options?.find(opt => getOptionInfo(opt).text === answer);
    const info = getOptionInfo(selectedOption);

    let updatedAnswers = { ...answers };
    if (currentQuestion.type === 'multiple_choice' && info.requireJustification) {
      updatedAnswers[currentQuestion.id] = `${answer} | Justificativa: ${justificationText.trim()}`;
    }

    setAnswers(updatedAnswers);
    setJustificationText('');
    setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!activeQuestionnaire?.questions || submitting || !isCurrentStepValid()) return;

    setSubmitting(true);
    try {
      const isAnonymous = !!activeQuestionnaire.is_anonymous;

      const barber = isAnonymous ? null : barbers.find(b => b.id === selectedBarber);
      const unit = isAnonymous ? null : units.find(u => u.id === selectedUnit);

      // Compilar a resposta da última pergunta
      const answer = answers[currentQuestion.id];
      const selectedOption = currentQuestion.options?.find(opt => getOptionInfo(opt).text === answer);
      const info = getOptionInfo(selectedOption);

      let finalAnswers = { ...answers };
      if (currentQuestion.type === 'multiple_choice' && info.requireJustification) {
        finalAnswers[currentQuestion.id] = `${answer} | Justificativa: ${justificationText.trim()}`;
      }

      // 1. Inserir cabeçalho da resposta
      const responseObj = {
        questionnaire_id: activeQuestionnaire.id,
        barber_id: isAnonymous ? null : selectedBarber,
        barber_name: isAnonymous ? 'Anônimo' : (barber?.name || 'Desconhecido'),
        unit_name: isAnonymous ? 'Anônimo' : (unit?.name || 'Geral')
      };

      const { data: respData, error: respErr } = await supabase
        .from('questionnaire_responses')
        .insert([responseObj])
        .select()
        .single();

      if (respErr) throw respErr;

      // 2. Inserir respostas individuais para cada pergunta
      const answersToInsert = activeQuestionnaire.questions.map(q => ({
        response_id: respData.id,
        question_id: q.id,
        answer_value: finalAnswers[q.id]
      }));

      const { error: ansErr } = await supabase
        .from('questionnaire_answers')
        .insert(answersToInsert);

      if (ansErr) throw ansErr;

      // Se for anônimo, gravar localmente para impedir múltiplos envios
      if (isAnonymous) {
        localStorage.setItem(`answered_${activeQuestionnaire.id}`, 'true');
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Erro ao enviar questionário:', err);
      alert('Falha ao enviar suas respostas. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 font-sans">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Carregando portal...</p>
        </div>
      </div>
    );
  }

  if (!activeQuestionnaire) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 px-4 font-sans">
        <div className="max-w-md w-full text-center bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl">
          <div className="w-16 h-16 bg-zinc-850 rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand">
            <ShieldAlert size={36} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-100 mb-3">Nenhum Questionário Ativo</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Não há nenhum questionário ativo para ser respondido no momento. Avisaremos quando uma nova pesquisa estiver disponível!
          </p>
        </div>
      </div>
    );
  }

  if (alreadyAnswered) {
    const isAnonymous = !!activeQuestionnaire.is_anonymous;

    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 px-4 font-sans">
        <div className="max-w-md w-full text-center bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl">
          <div className="w-16 h-16 bg-brand/10 text-brand rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-100 mb-3">Questionário Já Respondido</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Você já enviou suas respostas para o questionário: <br />
            <strong className="text-zinc-200">"{activeQuestionnaire.title}"</strong>.
          </p>
          {!isAnonymous && (
            <button
              onClick={() => {
                setAlreadyAnswered(false);
                setSelectedBarber('');
                setIsIdentified(false);
              }}
              className="w-full bg-zinc-800 text-zinc-300 py-3 rounded-xl font-semibold hover:bg-zinc-700 transition-colors text-sm"
            >
              Responder como outro barbeiro
            </button>
          )}
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 px-4 font-sans">
        <div className="max-w-md w-full text-center bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
            <Award size={48} />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-zinc-100 mb-3 uppercase italic">
            Muito Obrigado!
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-8">
            Suas respostas foram enviadas com sucesso e nos ajudarão a melhorar nosso clube de barbeiros!
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setSelectedBarber('');
              setIsIdentified(false);
              setAnswers({});
              setJustificationText('');
              setCurrentStep(0);
            }}
            className="w-full bg-brand text-white py-3 rounded-xl font-bold hover:bg-brand-light transition-colors text-sm uppercase tracking-wider"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  if (!isIdentified) {
    const isAnonymous = !!activeQuestionnaire.is_anonymous;

    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 px-4 py-12 font-sans">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-zinc-950 border border-zinc-800 rounded-2xl p-2.5 overflow-hidden mx-auto shadow-md">
              <img src={logoImg} alt="OWN Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand font-mono">OWN - QUESTIONÁRIOS</h2>
            <h1 className="text-xl font-black tracking-tight text-zinc-100 mt-1 uppercase italic">
              {isAnonymous ? 'Pesquisa Anônima' : 'Portal do Barbeiro'}
            </h1>
            <p className="text-zinc-400 text-xs mt-1">
              {isAnonymous 
                ? 'Suas respostas serão coletadas de forma totalmente privada.' 
                : 'Identifique-se para responder ao questionário ativo'}
            </p>
          </div>

          <div className="bg-zinc-950/60 p-4 border border-zinc-800/80 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block font-mono">Pesquisa Ativa</span>
            <span className="text-sm font-semibold text-zinc-200 block">{activeQuestionnaire.title}</span>
            {activeQuestionnaire.description && (
              <span className="text-xs text-zinc-400 block mt-1 leading-relaxed">{activeQuestionnaire.description}</span>
            )}
          </div>

          {isAnonymous ? (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-zinc-450 leading-relaxed text-center bg-zinc-950/30 p-3 rounded-lg border border-zinc-850">
                Esta pesquisa não coletará seu nome, unidade ou qualquer informação que possa identificá-lo.
              </p>
              <button
                onClick={() => setIsIdentified(true)}
                className="w-full flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-xl font-bold hover:bg-brand-light transition-colors uppercase text-xs tracking-wider pt-3.5 pb-3.5 mt-4 cursor-pointer"
              >
                Iniciar Responder Anônimo
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-400">Selecione sua Unidade</label>
                <select
                  value={selectedUnit}
                  onChange={(e) => {
                    setSelectedUnit(e.target.value);
                    setSelectedBarber('');
                  }}
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand cursor-pointer h-11"
                >
                  <option value="">Selecione...</option>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-400">Selecione seu Nome</label>
                <select
                  disabled={!selectedUnit}
                  value={selectedBarber}
                  onChange={(e) => setSelectedBarber(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand cursor-pointer h-11 disabled:opacity-50"
                >
                  <option value="">Selecione...</option>
                  {filteredBarbers.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <button
                disabled={!selectedUnit || !selectedBarber}
                onClick={handleStartQuestionnaire}
                className="w-full flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-xl font-bold hover:bg-brand-light transition-colors disabled:opacity-40 uppercase text-xs tracking-wider pt-3.5 pb-3.5 mt-6 cursor-pointer"
              >
                Iniciar Questionário
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const progressPercent = Math.round(((currentStep + 1) / questions.length) * 100);
  const selectedAnswer = answers[currentQuestion.id] || '';

  // Determinar se a opção selecionada necessita de justificativa
  const activeSelectedOption = currentQuestion?.options?.find(opt => getOptionInfo(opt).text === selectedAnswer);
  const selectedOptionInfo = getOptionInfo(activeSelectedOption);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between font-sans">
      {/* Header Fixo */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-zinc-950 border border-zinc-800 rounded-lg p-1 overflow-hidden flex items-center justify-center shadow-sm">
              <img src={logoImg} alt="OWN Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-[9px] font-bold uppercase tracking-wider text-brand font-mono">OWN - QUESTIONÁRIOS</h2>
              <h1 className="text-xs font-bold text-zinc-200 truncate max-w-[200px]">{activeQuestionnaire.title}</h1>
            </div>
          </div>
          <span className="text-xs text-zinc-500 font-semibold font-mono">
            {currentStep + 1} de {questions.length}
          </span>
        </div>
        <div className="max-w-lg mx-auto mt-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-brand transition-all duration-300 rounded-full" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Corpo da Pergunta */}
      <main className="max-w-lg w-full mx-auto px-4 py-12 flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <h3 className="text-xl sm:text-2xl font-bold text-zinc-100 leading-tight">
              {currentQuestion.text}
            </h3>

            <div className="mt-4">
              {/* Pergunta de Rating */}
              {currentQuestion.type === 'rating' && (
                <div className="flex justify-center items-center gap-2 py-4">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isSelected = selectedAnswer === String(star);
                    return (
                      <button
                        key={star}
                        onClick={() => handleAnswerSelect(currentQuestion.id, String(star))}
                        className={`p-3 rounded-full border transition-all ${
                          isSelected 
                            ? 'bg-brand/10 border-brand text-brand scale-110 shadow-lg shadow-brand/10' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                        }`}
                        title={`${star} estrelas`}
                      >
                        <Star size={32} fill={isSelected ? 'currentColor' : 'none'} />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Pergunta de Múltipla Escolha */}
              {currentQuestion.type === 'multiple_choice' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    {currentQuestion.options?.map((opt, optIdx) => {
                      const info = getOptionInfo(opt);
                      const isSelected = selectedAnswer === info.text;
                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleAnswerSelect(currentQuestion.id, info.text)}
                          className={`w-full px-4 py-4 rounded-xl text-left border text-sm font-semibold transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-brand/15 border-brand text-zinc-100 shadow-md shadow-brand/5 scale-[1.01]' 
                              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-850 hover:border-zinc-700'
                          }`}
                        >
                          {info.text}
                        </button>
                      );
                    })}
                  </div>

                  {/* Exibir justificativa se a opção selecionada exigir */}
                  {selectedOptionInfo.requireJustification && (
                    <div className="mt-4 space-y-2 animate-in slide-in-from-top-3 duration-250">
                      <label className="block text-xs font-semibold text-zinc-400">
                        Por favor, justifique sua escolha: <span className="text-brand">*</span>
                      </label>
                      <textarea
                        value={justificationText}
                        onChange={(e) => setJustificationText(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand min-h-[90px] resize-none focus:ring-1 focus:ring-brand/40"
                        placeholder="Escreva sua justificativa aqui..."
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Pergunta de Texto Livre */}
              {currentQuestion.type === 'text' && (
                <textarea
                  value={selectedAnswer}
                  onChange={(e) => handleAnswerSelect(currentQuestion.id, e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand min-h-[140px] resize-none focus:ring-1 focus:ring-brand/40"
                  placeholder="Escreva sua resposta aqui..."
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Fixo */}
      <footer className="bg-zinc-900 border-t border-zinc-800 px-4 py-4 sticky bottom-0">
        <div className="max-w-lg mx-auto flex justify-between gap-4">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center gap-2 bg-zinc-800 text-zinc-300 hover:text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-30 cursor-pointer"
          >
            <ArrowLeft size={16} />
            Anterior
          </button>

          {currentStep === questions.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={!isCurrentStepValid() || submitting}
              className="flex-1 flex items-center justify-center gap-2 bg-brand text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-brand-light transition-colors disabled:opacity-40 cursor-pointer"
            >
              {submitting ? 'Enviando...' : 'Enviar Questionário'}
              <Send size={16} />
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!isCurrentStepValid()}
              className="flex-1 flex items-center justify-center gap-2 bg-brand text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-brand-light transition-colors disabled:opacity-40 cursor-pointer"
            >
              Próxima
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
