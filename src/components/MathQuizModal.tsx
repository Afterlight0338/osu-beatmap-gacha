import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { sfx } from '../audio/sfx';
import {
  Calculator,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface MathQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReward: (bonusStamina: number) => void;
}

interface Question {
  text: string;
  options: number[];
  correctAnswer: number;
  explanation: string;
}

function generateQuestion(): Question {
  const types = ['bpm', 'combo', 'star', 'acc'];
  const type = types[Math.floor(Math.random() * types.length)];

  if (type === 'bpm') {
    const bpm = [160, 180, 200, 220, 240][Math.floor(Math.random() * 5)];
    const streams = [4, 8, 16][Math.floor(Math.random() * 3)];
    // Calculate taps per second
    const actualAns = Math.round((bpm / 60) * (streams / 4) * 4);
    const fake1 = actualAns + 4;
    const fake2 = Math.max(2, actualAns - 4);
    const fake3 = actualAns + 8;
    const options = [actualAns, fake1, fake2, fake3].sort(() => Math.random() - 0.5);

    return {
      text: `At ${bpm} BPM 1/4 streams, how many notes per second are tapped?`,
      options,
      correctAnswer: actualAns,
      explanation: `(${bpm} BPM ÷ 60s) × 4 notes per beat = ${actualAns} notes/second!`,
    };
  } else if (type === 'combo') {
    const n1 = Math.floor(Math.random() * 400) + 200;
    const n2 = Math.floor(Math.random() * 300) + 150;
    const ans = n1 + n2;
    const fake1 = ans + 10;
    const fake2 = ans - 10;
    const fake3 = ans + 25;
    const options = [ans, fake1, fake2, fake3].sort(() => Math.random() - 0.5);

    return {
      text: `You hold a ${n1} combo, break slider, then hit another ${n2} combo. Total hit count?`,
      options,
      correctAnswer: ans,
      explanation: `${n1} + ${n2} = ${ans} total combo notes hit!`,
    };
  } else {
    const a = Math.floor(Math.random() * 40) + 15;
    const b = Math.floor(Math.random() * 15) + 5;
    const ans = a * b;
    const fake1 = ans + b;
    const fake2 = ans - b;
    const fake3 = ans + 20;
    const options = [ans, fake1, fake2, fake3].sort(() => Math.random() - 0.5);

    return {
      text: `Quick Stamina Calc: ${a} × ${b} = ?`,
      options,
      correctAnswer: ans,
      explanation: `${a} × ${b} = ${ans}`,
    };
  }
}

export const MathQuizModal: React.FC<MathQuizModalProps> = ({
  isOpen,
  onClose,
  onReward,
}) => {
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);

  // Lock scroll
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      setQuestion(generateQuestion());
      setSelectedOption(null);
      setIsAnswered(false);
      setIsCorrect(false);
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  if (!isOpen || !question) return null;

  const handleSelect = (opt: number) => {
    if (isAnswered) return;
    sfx.playClick();
    setSelectedOption(opt);
    setIsAnswered(true);

    if (opt === question.correctAnswer) {
      setIsCorrect(true);
      sfx.playRarityReveal('Legendary');
      onReward(15); // Award +15 bonus stamina
    } else {
      setIsCorrect(false);
    }
  };

  const handleNext = () => {
    sfx.playClick();
    setQuestion(generateQuestion());
    setSelectedOption(null);
    setIsAnswered(false);
    setIsCorrect(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-[#131322] border border-purple-500/40 shadow-2xl p-6 space-y-5 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base font-display">
                Rhythm Math Quiz
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Answer correctly to earn <span className="text-amber-400 font-bold">+15 Bonus Stamina</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Question Text */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-center">
          <span className="text-[10px] font-mono text-purple-400 uppercase font-bold tracking-wider">
            osu! Quick Challenge
          </span>
          <p className="text-sm sm:text-base font-bold text-slate-100 leading-relaxed font-sans">
            {question.text}
          </p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-2.5">
          {question.options.map((opt, i) => {
            let btnStyle = 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-white';
            if (isAnswered) {
              if (opt === question.correctAnswer) {
                btnStyle = 'bg-emerald-600/30 border-emerald-500 text-emerald-300 font-bold';
              } else if (opt === selectedOption) {
                btnStyle = 'bg-rose-600/30 border-rose-500 text-rose-300';
              } else {
                btnStyle = 'opacity-40 bg-slate-950 border-slate-900 text-slate-500';
              }
            }

            return (
              <button
                key={i}
                disabled={isAnswered}
                onClick={() => handleSelect(opt)}
                className={`p-3.5 rounded-xl border text-sm font-mono transition-all font-bold ${btnStyle}`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {/* Answer Feedback */}
        {isAnswered && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-mono flex items-start space-x-2 animate-fade-in ${
              isCorrect
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                : 'bg-rose-950/60 border-rose-500 text-rose-200'
            }`}
          >
            {isCorrect ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <p className="font-bold">
                {isCorrect ? '🎉 Correct! +15 Bonus Stamina added!' : '❌ Incorrect!'}
              </p>
              <p className="text-[11px] text-slate-400 font-sans">{question.explanation}</p>
            </div>
          </div>
        )}

        {/* Action button */}
        {isAnswered && (
          <div className="flex space-x-2 pt-1">
            <button
              onClick={handleNext}
              className="flex-1 py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors shadow-md"
            >
              Next Question
            </button>
            <button
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
