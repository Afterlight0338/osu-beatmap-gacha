import React, { useState } from 'react';
import { useGacha } from '../context/GachaContext';
import { sfx } from '../audio/sfx';
import confetti from 'canvas-confetti';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Atom,
  Zap,
} from 'lucide-react';

interface SecretPhDModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecretPhDModal: React.FC<SecretPhDModalProps> = ({ isOpen, onClose }) => {
  const { refillEnergy } = useGacha();
  const [answerInput, setAnswerInput] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = answerInput.trim();

    if (clean === '727') {
      sfx.playRarityReveal('Divine');
      setStatus('success');
      await refillEnergy(50);

      confetti({
        particleCount: 200,
        spread: 140,
        origin: { y: 0.6 },
        colors: ['#00d2ff', '#ff007f', '#7928ca', '#ffffff', '#ffd700'],
      });
    } else {
      sfx.playClick();
      setStatus('error');
      setErrorMessage(
        'Evaluation Diverged: The spectral residue contour integral failed to evaluate to the integer eigenvalue. Check your pole residues.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl bg-[#0e0e18] border-2 border-cyan-500/50 shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-cyan-900/40 bg-slate-950/80">
          <div className="flex items-center space-x-2.5">
            <Atom className="w-5 h-5 text-cyan-400 animate-spin-slow" />
            <div>
              <h2 className="text-base font-black text-white font-mono tracking-wider">
                Doctoral Qualifying Examination in Analytic Number Theory
              </h2>
              <p className="text-[10px] font-mono text-cyan-400">
                Department of Pure Mathematics • Advanced Spectral & Residue Invariants
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {status !== 'success' ? (
            <>
              {/* LaTeX Question Simulation */}
              <div className="p-5 rounded-2xl bg-slate-950/90 border border-cyan-500/30 space-y-4 font-mono text-xs text-slate-300">
                <div className="flex items-center justify-between text-cyan-400 text-[11px] font-bold border-b border-cyan-900/40 pb-2">
                  <span>PROBLEM IV: Meromorphic Residue & Dirichlet Convolution Invariance</span>
                  <span>CREDITS: 50 PULLS</span>
                </div>

                <p className="leading-relaxed text-slate-300 font-serif text-sm">
                  Let <span className="font-mono text-pink-400 font-bold">\mathcal&#123;M&#125;</span> be a closed Riemann surface of genus <span className="font-mono text-cyan-400 font-bold">g = 1</span> endowed with the standard metric. Consider the meromorphic differential 1-form <span className="font-mono text-amber-300 font-bold">\omega(z)</span> and the arithmetic divisor function <span className="font-mono text-emerald-400 font-bold">\Lambda(n)</span> over the algebraic number field <span className="font-mono text-purple-400 font-bold">\mathbb&#123;Q&#125;(\sqrt&#123;-163&#125;)</span>.
                </p>

                <p className="leading-relaxed text-slate-300 font-serif text-sm">
                  Evaluate the exact integer value of the spectral trace invariant <span className="font-mono text-yellow-300 font-bold">\mathcal&#123;K&#125; \in \mathbb&#123;Z&#125;^+</span> defined by the contour integral:
                </p>

                <div className="p-4 rounded-xl bg-black/80 border border-slate-800 text-center font-mono text-cyan-200 text-sm overflow-x-auto space-y-2">
                  <p className="tracking-wide">
                    \mathcal&#123;K&#125; \;=\; \lim_&#123;N \to \infty&#125; \sum_&#123;n=1&#125;^N \frac&#123;\mu(n)&#125;&#123;n&#125; \left( \sum_&#123;d \mid n&#125; d \cdot \Lambda(n/d) \right) \;+\; \frac&#123;1&#125;&#123;2\pi i&#125; \oint_&#123;|z|=2&#125; \frac&#123;727\,z^&#123;2026&#125; + \sum_&#123;k=1&#125;^&#123;10&#125; \pi^k z^k&#125;&#123;z^&#123;2027&#125; - 1&#125; \, dz
                  </p>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                  <p>• <span className="text-slate-200 font-bold">\mu(n)</span> denotes the Möbius inversion function.</p>
                  <p>• <span className="text-slate-200 font-bold">\Lambda(n)</span> denotes the von Mangoldt arithmetic function.</p>
                  <p>• The contour integral is oriented counterclockwise along the circle <span className="text-slate-200 font-bold">|z| = 2</span> in the complex plane <span className="text-slate-200 font-bold">\mathbb&#123;C&#125;</span>.</p>
                </div>
              </div>

              {/* Error Alert */}
              {status === 'error' && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/80 text-rose-300 text-xs flex items-center space-x-2 animate-shake">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submission Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-slate-400 font-bold">
                    Exact Integer Evaluation (\mathcal&#123;K&#125;):
                  </label>
                  <input
                    type="text"
                    value={answerInput}
                    onChange={(e) => {
                      setAnswerInput(e.target.value);
                      if (status === 'error') setStatus('idle');
                    }}
                    placeholder="Enter exact integer..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-cyan-500/40 text-cyan-200 font-mono text-center text-lg tracking-widest focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    autoFocus
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02]"
                  >
                    Submit Proof Evaluation
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-3 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-mono text-xs transition-colors"
                  >
                    Close
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* Success State */
            <div className="py-8 text-center space-y-4 animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-white font-mono uppercase tracking-wider">
                  Q.E.D. Proof Invariance Confirmed
                </h3>
                <p className="text-xs font-mono text-emerald-400">
                  Residue contour evaluated precisely. Stamina fully refilled to 50 pulls!
                </p>
              </div>

              <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-2xl bg-slate-900 border border-emerald-500/40 text-emerald-300 font-mono text-xs">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Awarded: 50 Summon Tokens (Full Stamina)</span>
              </div>

              <div className="pt-4">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider transition-all"
                >
                  Return to Gacha
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
