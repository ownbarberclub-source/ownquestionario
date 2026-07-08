import React, { useState } from 'react';
import type { Questionnaire, Question, QuestionType } from '../types';
import { supabase } from '../supabaseClient';
import { Plus, Trash, ArrowUp, ArrowDown, Save, X, AlignLeft, Star, List } from 'lucide-react';

interface QuestionnaireCreatorProps {
  onClose: () => void;
  onSave: () => void;
}

interface LocalQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
}

export function QuestionnaireCreator({ onClose, onSave }: QuestionnaireCreatorProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<LocalQuestion[]>([]);
  const [saving, setSaving] = useState(false);

  const addQuestion = (type: QuestionType) => {
    const newQ: LocalQuestion = {
      id: crypto.randomUUID(),
      text: '',
      type,
      options: type === 'multiple_choice' ? ['Sim', 'Não'] : []
    };
    setQuestions([...questions, newQ]);
  };

  const updateQuestionText = (id: string, text: string) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, text } : q));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const addOption = (questionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return { ...q, options: [...q.options, 'Nova Opção'] };
      }
      return q;
    }));
  };

  const updateOptionText = (questionId: string, optionIndex: number, val: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        const nextOpt = [...q.options];
        nextOpt[optionIndex] = val;
        return { ...q, options: nextOpt };
      }
      return q;
    }));
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return { ...q, options: q.options.filter((_, idx) => idx !== optionIndex) };
      }
      return q;
    }));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= questions.length) return;

    const nextQuestions = [...questions];
    const temp = nextQuestions[index];
    nextQuestions[index] = nextQuestions[nextIndex];
    nextQuestions[nextIndex] = temp;
    setQuestions(nextQuestions);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('O título do questionário é obrigatório.');
      return;
    }
    if (questions.length === 0) {
      alert('Adicione pelo menos uma pergunta ao questionário.');
      return;
    }

    const invalidQuestion = questions.some(q => !q.text.trim());
    if (invalidQuestion) {
      alert('Todas as perguntas devem possuir um texto preenchido.');
      return;
    }

    const invalidOption = questions.some(q => q.type === 'multiple_choice' && q.options.length < 2);
    if (invalidOption) {
      alert('Perguntas de múltipla escolha devem ter no mínimo 2 opções.');
      return;
    }

    setSaving(true);
    try {
      // 1. Inserir o questionário
      const newQuest = {
        id: crypto.randomUUID(),
        title: title.trim(),
        description: description.trim(),
        is_active: false // É criado como inativo por padrão
      };

      const { error: questErr } = await supabase
        .from('barber_questionnaires')
        .insert([newQuest]);

      if (questErr) throw questErr;

      // 2. Inserir as perguntas vinculadas
      const questionsToInsert = questions.map((q, idx) => ({
        id: q.id,
        questionnaire_id: newQuest.id,
        text: q.text.trim(),
        type: q.type,
        options: q.type === 'multiple_choice' ? q.options : null,
        sort_order: idx
      }));

      const { error: questQuestionsErr } = await supabase
        .from('questionnaire_questions')
        .insert(questionsToInsert);

      if (questQuestionsErr) throw questQuestionsErr;

      alert('Questionário criado com sucesso!');
      onSave();
      onClose();
    } catch (err) {
      console.error('Erro ao salvar questionário:', err);
      alert('Erro ao salvar questionário no banco.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <div>
            <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-brand" />
              Novo Questionário
            </h2>
            <p className="text-xs text-zinc-400 mt-1">Crie um questionário personalizado para os barbeiros</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-2 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Dados Gerais */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400">Título do Questionário</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-brand"
                placeholder="Ex: Feedback Semanal de Suporte"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400">Descrição (Opcional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand min-h-[60px] resize-none"
                placeholder="Ex: Esse formulário serve para medirmos as necessidades da equipe de barbeiros."
              />
            </div>
          </div>

          {/* Seção das Perguntas */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Perguntas ({questions.length})</h3>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addQuestion('rating')}
                  className="flex items-center gap-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-800 cursor-pointer"
                >
                  <Star className="w-3.5 h-3.5" />
                  + Avaliação (1-5)
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion('multiple_choice')}
                  className="flex items-center gap-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-800 cursor-pointer"
                >
                  <List className="w-3.5 h-3.5" />
                  + Múltipla Escolha
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion('text')}
                  className="flex items-center gap-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-800 cursor-pointer"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  + Discursiva (Texto)
                </button>
              </div>
            </div>

            {questions.length === 0 ? (
              <div className="bg-zinc-950/40 border border-zinc-850 p-8 rounded-xl text-center text-zinc-500 text-xs leading-relaxed">
                Nenhuma pergunta adicionada ainda. Clique nos botões acima para adicionar perguntas!
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q, index) => (
                  <div key={q.id} className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 space-y-3 relative">
                    
                    {/* Linha Topo da Pergunta */}
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-brand font-mono">
                        Pergunta {index + 1} — {q.type === 'rating' ? 'Avaliação (1-5)' : q.type === 'multiple_choice' ? 'Múltipla Escolha' : 'Texto Livre'}
                      </span>
                      
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveQuestion(index, 'up')}
                          className="p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 cursor-pointer"
                          title="Mover para cima"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={index === questions.length - 1}
                          onClick={() => moveQuestion(index, 'down')}
                          className="p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 cursor-pointer"
                          title="Mover para baixo"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeQuestion(q.id)}
                          className="p-1 text-red-400 hover:text-red-300 ml-1 cursor-pointer"
                          title="Remover pergunta"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Campo de Texto da Pergunta */}
                    <input
                      type="text"
                      required
                      value={q.text}
                      onChange={(e) => updateQuestionText(q.id, e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-brand"
                      placeholder="Qual a sua pergunta?"
                    />

                    {/* Se for Múltipla Escolha, gerenciar Opções */}
                    {q.type === 'multiple_choice' && (
                      <div className="pl-4 border-l border-zinc-800 space-y-2 mt-2">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-zinc-400">Opções da Resposta</label>
                          <button
                            type="button"
                            onClick={() => addOption(q.id)}
                            className="text-[10px] text-brand hover:underline font-semibold cursor-pointer"
                          >
                            + Adicionar Opção
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <input
                                type="text"
                                required
                                value={opt}
                                onChange={(e) => updateOptionText(q.id, optIdx, e.target.value)}
                                className="flex-1 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-200 focus:outline-none focus:border-brand"
                                placeholder={`Opção ${optIdx + 1}`}
                              />
                              <button
                                type="button"
                                disabled={q.options.length <= 2}
                                onClick={() => removeOption(q.id, optIdx)}
                                className="text-zinc-500 hover:text-zinc-300 disabled:opacity-20 cursor-pointer"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botões do Rodapé */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-sm font-semibold hover:bg-zinc-700 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-brand text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-brand-light transition-all cursor-pointer shadow-lg shadow-brand/10 disabled:opacity-55"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Questionário'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
