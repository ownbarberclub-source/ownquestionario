import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import type { Questionnaire, Question, QuestionnaireResponse } from '../types';
import { QuestionnaireCreator } from './QuestionnaireCreator';
import { 
  FileText, Plus, Trash, CheckCircle2, Circle, 
  BarChart3, Users, Clock, RefreshCw, ChevronDown, ChevronUp, Star 
} from 'lucide-react';

export function AdminDashboard() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [selectedQuestId, setSelectedQuestId] = useState<string>('');
  const [responses, setResponses] = useState<QuestionnaireResponse[]>([]);
  
  // Modais e Status
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);

  // Filtros
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterBarberSearch, setFilterBarberSearch] = useState<string>('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (selectedQuestId) {
      loadResponses(selectedQuestId);
    } else {
      setResponses([]);
    }
  }, [selectedQuestId]);

  const loadDashboardData = async () => {
    try {
      // Carrega todos os questionários com suas perguntas
      const { data: questsData } = await supabase
        .from('barber_questionnaires')
        .select('*')
        .order('created_at', { ascending: false });

      if (questsData && questsData.length > 0) {
        setQuestionnaires(questsData);
        // Selecionar o primeiro questionário (ou o ativo) por padrão
        const active = questsData.find(q => q.is_active);
        setSelectedQuestId(active ? active.id : questsData[0].id);
      } else {
        setQuestionnaires([]);
        setSelectedQuestId('');
      }
    } catch (err) {
      console.error('Erro ao carregar questionários:', err);
    }
  };

  const loadResponses = async (questId: string) => {
    try {
      // 1. Carrega todas as respostas para o questionário selecionado
      const { data: respData } = await supabase
        .from('questionnaire_responses')
        .select('*')
        .eq('questionnaire_id', questId)
        .order('answered_at', { ascending: false });

      if (!respData) {
        setResponses([]);
        return;
      }

      // 2. Carrega as respostas detalhadas a nível de pergunta
      const responseIds = respData.map(r => r.id);
      if (responseIds.length === 0) {
        setResponses(respData);
        return;
      }

      const { data: ansData } = await supabase
        .from('questionnaire_answers')
        .select('*')
        .in('response_id', responseIds);

      // Agrupa as respostas nos objetos de cabeçalho
      const mappedResponses = respData.map(r => ({
        ...r,
        answers: ansData?.filter(a => a.response_id === r.id) || []
      }));

      setResponses(mappedResponses);
    } catch (err) {
      console.error('Erro ao carregar respostas:', err);
    }
  };

  const handleToggleActive = async (questId: string, currentActive: boolean) => {
    try {
      if (!currentActive) {
        // Ativar questionário -> Desativar qualquer outro ativo primeiro
        await supabase
          .from('barber_questionnaires')
          .update({ is_active: false })
          .eq('is_active', true);
      }

      await supabase
        .from('barber_questionnaires')
        .update({ is_active: !currentActive })
        .eq('id', questId);

      loadDashboardData();
    } catch (err) {
      console.error('Erro ao alterar status do questionário:', err);
    }
  };

  const handleDeleteQuestionnaire = async (questId: string, title: string) => {
    if (!window.confirm(`Tem certeza que deseja EXCLUIR o questionário "${title}"? Todas as respostas salvas nele serão deletadas permanentemente.`)) {
      return;
    }

    try {
      await supabase
        .from('barber_questionnaires')
        .delete()
        .eq('id', questId);

      loadDashboardData();
    } catch (err) {
      console.error('Erro ao excluir questionário:', err);
    }
  };

  // Carrega as perguntas do questionário selecionado atualmente
  const selectedQuestionnaire = useMemo(() => {
    return questionnaires.find(q => q.id === selectedQuestId) || null;
  }, [questionnaires, selectedQuestId]);

  const [selectedQuestQuestions, setSelectedQuestQuestions] = useState<Question[]>([]);

  useEffect(() => {
    if (selectedQuestId) {
      supabase
        .from('questionnaire_questions')
        .select('*')
        .eq('questionnaire_id', selectedQuestId)
        .order('sort_order', { ascending: true })
        .then(({ data }) => {
          setSelectedQuestQuestions(data || []);
        });
    } else {
      setSelectedQuestQuestions([]);
    }
  }, [selectedQuestId]);

  // Filtragem de respostas baseada nos filtros de UI
  const filteredResponses = useMemo(() => {
    return responses.filter(r => {
      const matchUnit = filterUnit === 'all' || r.unit_name === filterUnit;
      const matchBarber = !filterBarberSearch.trim() || 
        r.barber_name.toLowerCase().includes(filterBarberSearch.toLowerCase());
      return matchUnit && matchBarber;
    });
  }, [responses, filterUnit, filterBarberSearch]);

  // Cálculos de Relatórios Consolidados
  const analytics = useMemo(() => {
    if (filteredResponses.length === 0 || selectedQuestQuestions.length === 0) return null;

    const total = filteredResponses.length;

    // Respostas por unidade
    const unitsMap: Record<string, number> = {};
    filteredResponses.forEach(r => {
      unitsMap[r.unit_name] = (unitsMap[r.unit_name] || 0) + 1;
    });

    // Análise por pergunta
    const questionsAnalysis = selectedQuestQuestions.map(q => {
      const qAnswers = filteredResponses.flatMap(r => r.answers || []).filter(a => a.question_id === q.id);
      
      let averageRating = 0;
      let optionsCounts: Record<string, number> = {};
      let textResponses: { barber: string; unit: string; val: string }[] = [];

      if (q.type === 'rating') {
        const totalRating = qAnswers.reduce((acc, a) => acc + Number(a.answer_value || 0), 0);
        averageRating = qAnswers.length > 0 ? parseFloat((totalRating / qAnswers.length).toFixed(1)) : 0;
      } else if (q.type === 'multiple_choice') {
        const getOptionText = (opt: any): string => {
          if (!opt) return '';
          if (typeof opt === 'string') return opt;
          return opt.text || '';
        };

        // Inicializa com 0 para todas as opções
        q.options?.forEach(opt => {
          const text = getOptionText(opt);
          if (text) optionsCounts[text] = 0;
        });

        qAnswers.forEach(a => {
          if (a.answer_value) {
            const rawVal = a.answer_value;
            const optionText = rawVal.includes(' | Justificativa: ')
              ? rawVal.split(' | Justificativa: ')[0]
              : rawVal;
            optionsCounts[optionText] = (optionsCounts[optionText] || 0) + 1;
          }
        });

        // Coleta justificativas associadas a múltipla escolha
        const justificationsList: { option: string; barber: string; unit: string; val: string }[] = [];
        filteredResponses.forEach(r => {
          const ans = r.answers?.find(a => a.question_id === q.id);
          if (ans?.answer_value && ans.answer_value.includes(' | Justificativa: ')) {
            const [optText, justText] = ans.answer_value.split(' | Justificativa: ');
            justificationsList.push({
              option: optText,
              barber: r.barber_name,
              unit: r.unit_name,
              val: justText
            });
          }
        });
        
        // Adiciona à análise
        (q as any).optionJustifications = justificationsList;
      } else if (q.type === 'text') {
        textResponses = filteredResponses.map(r => {
          const ans = r.answers?.find(a => a.question_id === q.id);
          return {
            barber: r.barber_name,
            unit: r.unit_name,
            val: ans?.answer_value || ''
          };
        }).filter(item => item.val.trim().length > 0);
      }

      return {
        id: q.id,
        text: q.text,
        type: q.type,
        averageRating,
        optionsCounts,
        textResponses,
        optionJustifications: (q as any).optionJustifications || []
      };
    });

    return {
      total,
      units: unitsMap,
      questions: questionsAnalysis
    };
  }, [filteredResponses, selectedQuestQuestions]);

  return (
    <div className="space-y-6">
      
      {/* Barra de Ações do Admin */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-black text-zinc-100 uppercase tracking-tight italic">
            Controle de Questionários
          </h2>
          <p className="text-xs text-zinc-400 mt-1">Crie questionários para obter avaliações e feedbacks de sua equipe</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsCreatorOpen(true)}
            className="flex items-center justify-center gap-2 bg-brand text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-light transition-colors shadow-lg shadow-brand/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Criar Questionário
          </button>
          <button
            onClick={loadDashboardData}
            className="p-2.5 bg-zinc-800 text-zinc-400 rounded-xl hover:text-zinc-100 transition-colors border border-zinc-700 cursor-pointer"
            title="Sincronizar Dados"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Principal: Listagem de Questionários e Resumo de Respostas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Lado Esquerdo: Lista de Questionários Criados */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand" />
            Pesquisas Criadas ({questionnaires.length})
          </h3>

          {questionnaires.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">
              Nenhum questionário cadastrado ainda.
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[500px]">
              {questionnaires.map(quest => {
                const isSelected = quest.id === selectedQuestId;
                return (
                  <div
                    key={quest.id}
                    onClick={() => setSelectedQuestId(quest.id)}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-zinc-850 border-brand/50 shadow-md' 
                        : 'bg-zinc-950/40 border-zinc-850 hover:bg-zinc-850 hover:border-zinc-800'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="text-sm font-bold text-zinc-100 line-clamp-1">{quest.title}</h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteQuestionnaire(quest.id, quest.title);
                        }}
                        className="text-zinc-500 hover:text-red-400 p-0.5 transition-colors cursor-pointer"
                        title="Deletar Questionário"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                      {quest.description || 'Sem descrição.'}
                    </p>

                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-800/80">
                      {/* Badge Ativo / Inativo */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(quest.id, quest.is_active);
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          quest.is_active 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700/60'
                        }`}
                        title={quest.is_active ? 'Clique para Desativar' : 'Clique para Ativar'}
                      >
                        {quest.is_active ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <Circle className="w-3 h-3 text-zinc-400" />
                            Inativo
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lado Direito: KPIs e Analytics da Pesquisa Selecionada */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Seletor Móvel/Informações da Pesquisa Selecionada */}
          {selectedQuestionnaire && (
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-md space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">{selectedQuestionnaire.title}</h3>
                  {selectedQuestionnaire.description && (
                    <p className="text-xs text-zinc-400 mt-1">{selectedQuestionnaire.description}</p>
                  )}
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${
                    selectedQuestionnaire.is_active 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                    {selectedQuestionnaire.is_active ? 'Pesquisa Ativa 📱' : 'Arquivada/Inativa'}
                  </span>
                </div>
              </div>

              {/* Filtros das respostas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-950/40 p-4 border border-zinc-850 rounded-xl">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Filtrar Unidade</label>
                  <select
                    value={filterUnit}
                    onChange={(e) => setFilterUnit(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand cursor-pointer h-9"
                  >
                    <option value="all">Todas as Unidades</option>
                    <option value="Matriz">Matriz</option>
                    <option value="Avenida">Avenida</option>
                    <option value="Efapi">Efapi</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Buscar Barbeiro</label>
                  <input
                    type="text"
                    value={filterBarberSearch}
                    onChange={(e) => setFilterBarberSearch(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand h-9"
                    placeholder="Nome do barbeiro..."
                  />
                </div>
              </div>

              {/* KPIs Rápidas */}
              {analytics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-zinc-950/40 border border-zinc-850 rounded-xl p-4 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Respostas</span>
                    </div>
                    <span className="text-xl font-bold text-zinc-100">{analytics.total}</span>
                  </div>
                  <div className="bg-zinc-950/40 border border-zinc-850 rounded-xl p-4 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Matriz</span>
                    </div>
                    <span className="text-xl font-bold text-zinc-100">{analytics.units['Matriz'] || 0}</span>
                  </div>
                  <div className="bg-zinc-950/40 border border-zinc-850 rounded-xl p-4 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Avenida</span>
                    </div>
                    <span className="text-xl font-bold text-zinc-100">{analytics.units['Avenida'] || 0}</span>
                  </div>
                  <div className="bg-zinc-950/40 border border-zinc-850 rounded-xl p-4 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Efapi</span>
                    </div>
                    <span className="text-xl font-bold text-zinc-100">{analytics.units['Efapi'] || 0}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Gráficos / Consolidado de Respostas */}
          {analytics ? (
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-md space-y-6">
              <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Relatório Consolidado</h3>

              <div className="space-y-6">
                {analytics.questions.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-zinc-950/40 border border-zinc-850 rounded-xl space-y-4">
                    <div className="flex justify-between items-start gap-3">
                      <h4 className="text-sm font-bold text-zinc-200">
                        {idx + 1}. {q.text}
                      </h4>
                      <span className="text-[9px] uppercase tracking-widest font-mono font-bold bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">
                        {q.type === 'rating' ? 'Nota' : q.type === 'multiple_choice' ? 'Escolha' : 'Texto'}
                      </span>
                    </div>

                    {/* Resposta de Rating */}
                    {q.type === 'rating' && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center text-yellow-500 gap-0.5">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Star 
                              key={star} 
                              size={16} 
                              fill={star <= Math.round(q.averageRating) ? 'currentColor' : 'none'} 
                              className={star <= Math.round(q.averageRating) ? 'text-yellow-500' : 'text-zinc-700'}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-bold text-zinc-100">
                          {q.averageRating} / 5.0 de média
                        </span>
                      </div>
                    )}

                    {/* Resposta de Múltipla Escolha */}
                    {q.type === 'multiple_choice' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          {Object.entries(q.optionsCounts).map(([opt, count]) => {
                            const percent = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
                            return (
                              <div key={opt} className="space-y-1">
                                <div className="flex justify-between text-xs font-semibold text-zinc-300">
                                  <span>{opt}</span>
                                  <span>{count} ({percent}%)</span>
                                </div>
                                <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
                                  <div className="h-full bg-brand rounded-full" style={{ width: `${percent}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Justificativas Coletadas para esta pergunta de escolha múltipla */}
                        {q.optionJustifications && q.optionJustifications.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-zinc-800/60 space-y-2">
                            <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Justificativas Apresentadas:</h5>
                            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                              {q.optionJustifications.map((j: any, jIdx: number) => (
                                <div key={jIdx} className="bg-zinc-900/60 border border-zinc-850 p-2 px-3 rounded-lg text-xs leading-relaxed space-y-1">
                                  <p className="text-zinc-200">
                                    <span className="text-brand font-semibold text-[10px] uppercase mr-1.5">[{j.option}]</span>
                                    "{j.val}"
                                  </p>
                                  <p className="text-[10px] text-zinc-500 text-right font-medium">
                                    — {j.barber} ({j.unit})
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Resposta de Texto Livre */}
                    {q.type === 'text' && (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {q.textResponses.length === 0 ? (
                          <p className="text-xs text-zinc-500">Nenhum comentário enviado ainda.</p>
                        ) : (
                          q.textResponses.map((tr, trIdx) => (
                            <div key={trIdx} className="bg-zinc-900/60 border border-zinc-850 p-2.5 rounded-lg text-xs leading-relaxed space-y-1">
                              <p className="text-zinc-200">"{tr.val}"</p>
                              <p className="text-[10px] text-zinc-500 text-right font-medium">
                                — {tr.barber} ({tr.unit})
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 p-12 rounded-2xl text-center text-zinc-500 text-sm">
              Sem respostas registradas para este questionário no momento.
            </div>
          )}

        </div>

      </div>

      {/* Histórico Individual de Respostas Submetidas */}
      {filteredResponses.length > 0 && selectedQuestionnaire && (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand" />
            Respostas Individuais ({filteredResponses.length})
          </h3>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredResponses.map(resp => {
              const isExpanded = expandedResponse === resp.id;
              return (
                <div key={resp.id} className="bg-zinc-950/40 border border-zinc-850 rounded-xl overflow-hidden">
                  <div 
                    onClick={() => setExpandedResponse(isExpanded ? null : resp.id)}
                    className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 cursor-pointer hover:bg-zinc-850/20 transition-all"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-zinc-200">{resp.barber_name}</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Unidade: {resp.unit_name} • Respondido em: {new Date(resp.answered_at).toLocaleDateString('pt-BR')} às {new Date(resp.answered_at).toLocaleTimeString('pt-BR')}
                      </p>
                    </div>

                    <button className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline cursor-pointer">
                      {isExpanded ? (
                        <>
                          Esconder Respostas
                          <ChevronUp className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          Ver Respostas
                          <ChevronDown className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="p-4 bg-zinc-900/40 border-t border-zinc-850 space-y-4">
                      {selectedQuestQuestions.map((q, idx) => {
                        const ans = resp.answers?.find(a => a.question_id === q.id);
                        return (
                          <div key={q.id} className="space-y-1 pl-3 border-l-2 border-brand/40">
                            <p className="text-xs font-bold text-zinc-300">{idx + 1}. {q.text}</p>
                            <p className="text-sm text-zinc-100 font-medium">
                              {q.type === 'rating' ? (
                                <span className="flex items-center gap-1 text-yellow-500">
                                  {ans?.answer_value} ★
                                </span>
                              ) : (
                                ans?.answer_value || '-'
                              )}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Criador de Questionários */}
      {isCreatorOpen && (
        <QuestionnaireCreator
          onClose={() => setIsCreatorOpen(false)}
          onSave={loadDashboardData}
        />
      )}

    </div>
  );
}
