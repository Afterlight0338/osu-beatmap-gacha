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
    const clean = answerInput.trim().toLowerCase().replace(/\s+/g, '');

    if (clean === '727' || clean === 'wysi' || clean === '727pp' || clean === 'whenyouseeit') {
      sfx.playRarityReveal('Divine');
      setStatus('success');
      await refillEnergy(50);

      confetti({
        particleCount: 180,
        spread: 140,
        origin: { y: 0.6 },
        colors: ['#00d2ff', '#ff007f', '#7928ca', '#ffffff', '#ffd700'],
      });
    } else {
      sfx.playClick();
      setStatus('error');
      setErrorMessage(
        'Evaluation Diverged! Quantum tensor collapsed without resonance. (Hint: Blue Zenith HDHR 727pp)'
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
                Quantum Circle-Clicking Spectral Invariance Examination
              </h2>
              <p className="text-[10px] font-mono text-cyan-400">
                Department of Advanced Theoretical osu! Dynamics • Doctoral Level Exam
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
                  <span>PROBLEM 727.1 (Nonlinear Harmonic Manifolds)</span>
                  <span>TIME LIMIT: ∞</span>
                </div>

                <p className="leading-relaxed text-slate-300">
                  Let <span className="text-pink-400 font-bold">ℋ</span> be a separable Hilbert space and let{' '}
                  <span className="text-cyan-400 font-bold">T: ℋ → ℋ</span> be a trace-class Hamiltonian operator
                  governing the relativistic 4-dimensional finger-control trajectory over the compact Riemann surface{' '}
                  <span className="text-amber-300 font-bold">Σ_g</span>.
                </p>

                <div className="p-3.5 rounded-xl bg-black/60 border border-slate-800 text-center font-mono text-cyan-200 text-xs sm:text-sm overflow-x-auto space-y-1">
                  <p>
                    𝒵(s) = ∮_{'{∂Ω}'} [ det(𝕀 + 𝜖∇²_Cookiezi) / ∏_{'{k=1}'}^{'{727}'}(1 - qᵏ) ] · dz
                  </p>
                  <p className="text-[11px] text-pink-300">
                    lim_{'{s → 1}'} (s - 1)ζ(s) + ⟨BlueZenith | FOUR_DIMENSIONS⟩ ≡ 𝚲 (mod 727)
                  </p>
                </div>

                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Assuming the Birch and Swinnerton-Dyer conjecture holds for the elliptic curve{' '}
                  <span className="text-white">y² = x³ - 727x</span>, determine the exact positive integer eigenvalue{' '}
                  <span className="text-amber-300 font-bold">𝚲 ∈ ℤ⁺</span> describing the global performance point resonance.
                </p>
              </div>

              {/* Form Input */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-400 flex items-center justify-between">
                    <span>Enter your theoretical solution (Integer):</span>
                    <span className="text-cyan-400 font-mono text-[10px]">Proof required in ℝ</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={answerInput}
                      onChange={(e) => {
                        setAnswerInput(e.target.value);
                        if (status === 'error') setStatus('idle');
                      }}
                      placeholder="e.g. 727"
                      className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:outline-none text-slate-100 font-mono text-sm"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold font-mono text-xs sm:text-sm uppercase tracking-wider transition-all shadow-lg shadow-cyan-600/30"
                    >
                      Verify Proof
                    </button>
                  </div>
                </div>

                {status === 'error' && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600/60 text-rose-300 text-xs font-mono flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </form>
            </>
          ) : (
            /* SUCCESS 727 / WYSI CELEBRATION */
            <div className="py-6 text-center space-y-5 animate-scale-up">
              <div className="relative inline-flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-cyan-500/20 border-2 border-cyan-400 animate-ping absolute" />
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 to-pink-500 flex items-center justify-center shadow-xl shadow-cyan-500/50">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-pink-400 to-amber-300 font-display">
                  WHEN YOU SEE IT (WYSI)!
                </h3>
                <p className="text-xl font-bold font-mono text-cyan-300">
                  ★ 727 PP RECORD CONFIRMED ★
                </p>
                <p className="text-xs font-mono text-slate-300 max-w-md mx-auto pt-2">
                  "Cookiezi [FOUR DIMENSIONS] +HDHR 727pp" has successfully collapsed the wave function!
                </p>
              </div>

              {/* Bonus Award Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/80 via-purple-950/80 to-pink-950/80 border border-cyan-400/50 inline-flex items-center space-x-3 text-left">
                <Zap className="w-8 h-8 text-amber-400 animate-bounce" />
                <div>
                  <p className="text-xs font-bold text-slate-100 uppercase font-mono">
                    Cookiezi's Divine Blessing Awarded:
                  </p>
                  <p className="text-sm font-extrabold text-cyan-300 font-mono">
                    +50 Full Max Pull Energy Instant Recharge! ⚡
                  </p>
                </div>
              </div>

              <div>
                <button
                  onClick={onClose}
                  className="px-8 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold font-mono text-sm tracking-wider uppercase shadow-lg shadow-cyan-600/30 transition-transform hover:scale-105"
                >
                  Return to Summoning
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
