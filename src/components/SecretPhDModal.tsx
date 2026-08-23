import React, { useState, useEffect } from 'react';
import { useGacha } from '../context/GachaContext';
import { sfx } from '../audio/sfx';
import confetti from 'canvas-confetti';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Atom,
  Zap,
  BookOpen,
  Check,
  ChevronRight,
} from 'lucide-react';

interface SecretPhDModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MathProblem {
  id: number;
  romanNumeral: string;
  title: string;
  field: string;
  rewardPulls: number;
  expectedAnswer: string;
  description: React.ReactNode;
  equation: React.ReactNode;
  notes: string[];
}

const MATH_PROBLEMS: MathProblem[] = [
  {
    id: 1,
    romanNumeral: 'I',
    title: 'Meromorphic Residue & Dirichlet Convolution Invariance',
    field: 'Analytic Number Theory & Contour Integration',
    rewardPulls: 50,
    expectedAnswer: '727',
    description: (
      <p className="leading-relaxed text-slate-300 text-sm">
        Let <span className="font-serif italic font-bold text-pink-400">ℳ</span> be a closed Riemann surface of genus <span className="font-mono text-cyan-400 font-bold">g = 1</span>. Consider the meromorphic differential 1-form <span className="font-serif italic font-bold text-amber-300">ω(z)</span> and the arithmetic divisor function <span className="font-serif italic font-bold text-emerald-400">Λ(n)</span> over <span className="font-serif font-bold text-purple-300">ℚ(√−163)</span>. Evaluate the spectral trace invariant <span className="font-serif italic font-bold text-yellow-300">𝒦 ∈ ℤ⁺</span>:
      </p>
    ),
    equation: (
      <div className="min-w-fit flex items-center justify-center space-x-2 text-cyan-200 text-sm sm:text-base font-serif select-none py-1">
        <span className="text-yellow-300 font-bold text-xl italic mr-1">𝒦₁</span>
        <span className="text-white font-bold text-lg">=</span>
        <div className="inline-flex items-center space-x-1">
          <div className="inline-flex flex-col items-center leading-none text-xs">
            <span className="font-serif text-sm">lim</span>
            <span className="text-[10px] text-slate-400 font-mono">N → ∞</span>
          </div>
          <div className="inline-flex flex-col items-center leading-none text-xs">
            <span className="text-[10px] text-slate-400 font-mono">N</span>
            <span className="text-xl font-serif">∑</span>
            <span className="text-[10px] text-slate-400 font-mono">n=1</span>
          </div>
          <div className="inline-flex flex-col items-center justify-center text-xs px-1">
            <span className="border-b border-cyan-400/60 pb-0.5 px-1 font-serif italic text-pink-300">μ(n)</span>
            <span className="pt-0.5 px-1 font-mono text-slate-300">n</span>
          </div>
          <div className="inline-flex items-center text-xs">
            <span className="text-slate-400 text-base">(</span>
            <div className="inline-flex flex-col items-center leading-none px-0.5">
              <span className="text-base font-serif">∑</span>
              <span className="text-[9px] text-slate-400 font-mono">d | n</span>
            </div>
            <span className="font-mono text-slate-200">d · <span className="font-serif italic text-emerald-300">Λ</span>(n/d)</span>
            <span className="text-slate-400 text-base">)</span>
          </div>
        </div>
        <span className="text-white font-bold text-lg px-1">+</span>
        <div className="inline-flex items-center space-x-1">
          <div className="inline-flex flex-col items-center justify-center text-xs px-1">
            <span className="border-b border-cyan-400/60 pb-0.5 px-1 font-mono text-slate-200">1</span>
            <span className="pt-0.5 px-1 font-serif text-slate-300">2πi</span>
          </div>
          <div className="inline-flex flex-col items-center leading-none text-xs">
            <span className="text-2xl font-serif text-cyan-300 leading-none">∮</span>
            <span className="text-[10px] text-cyan-400 font-mono">|z| = 2</span>
          </div>
          <div className="inline-flex flex-col items-center justify-center text-xs px-2 font-mono">
            <div className="border-b border-cyan-400/60 pb-1 px-2 flex items-center space-x-1">
              <span className="text-yellow-300 font-bold">727</span>
              <span>· z<sup>2026</sup> + ∑<sub>k=1</sub><sup>10</sup> π<sup>k</sup> z<sup>k</sup></span>
            </div>
            <div className="pt-1 px-2 text-slate-300">
              <span>z<sup>2027</sup> − 1</span>
            </div>
          </div>
          <span className="font-serif italic text-cyan-300 text-sm sm:text-base ml-1">dz</span>
        </div>
      </div>
    ),
    notes: [
      'μ(n) denotes the arithmetic Möbius inversion function.',
      'Λ(n) denotes the von Mangoldt arithmetic prime function.',
      'The contour integral is oriented counterclockwise along |z| = 2 in ℂ.',
    ],
  },
  {
    id: 2,
    romanNumeral: 'II',
    title: 'Monstrous Moonshine & Genus-Zero Modular Hauptmodul',
    field: 'Sporadic Finite Simple Groups & Modular Forms',
    rewardPulls: 100,
    expectedAnswer: '196884',
    description: (
      <p className="leading-relaxed text-slate-300 text-sm">
        Let <span className="font-serif font-bold text-pink-400">𝕄</span> denote the Fischer–Griess Monster sporadic simple group. Consider the normalized Hauptmodul <span className="font-serif italic font-bold text-cyan-300">J(τ) = q⁻¹ + ∑ c(n) qⁿ</span> for the modular curve <span className="font-mono text-purple-300">X₀(1) = ℍ/PSL₂(ℤ)</span>. Compute the linear Fourier coefficient <span className="font-mono font-bold text-yellow-300">c(1)</span>:
      </p>
    ),
    equation: (
      <div className="min-w-fit flex items-center justify-center space-x-2 text-cyan-200 text-base font-serif select-none py-1">
        <span className="text-yellow-300 font-bold text-xl italic">c(1)</span>
        <span className="text-white font-bold">=</span>
        <span className="text-slate-200">1</span>
        <span className="text-white font-bold">+</span>
        <span className="font-mono text-pink-300 font-bold">dim(ρ₁)</span>
        <span className="text-slate-400 text-sm font-mono">where ρ₁ is the minimal non-trivial irreducible representation of 𝕄</span>
      </div>
    ),
    notes: [
      'J(τ) = (E₄(τ)³ / Δ(τ)) − 720.',
      'dim(ρ₁) = 196,883 represents the smallest faithful representation of the Monster group.',
    ],
  },
  {
    id: 3,
    romanNumeral: 'III',
    title: 'Exceptional Simple Lie Algebra 𝔢₈ Adjoint Dimension',
    field: 'Lie Algebras & Root Systems',
    rewardPulls: 100,
    expectedAnswer: '248',
    description: (
      <p className="leading-relaxed text-slate-300 text-sm">
        Let <span className="font-serif font-bold text-amber-300">𝔢₈</span> be the exceptional complex simple Lie algebra of rank <span className="font-mono text-cyan-400 font-bold">8</span>. Evaluate the total dimension of its fundamental adjoint representation <span className="font-mono text-yellow-300 font-bold">dim(𝔢₈)</span>:
      </p>
    ),
    equation: (
      <div className="min-w-fit flex items-center justify-center space-x-2 text-cyan-200 text-base font-serif select-none py-1">
        <span className="text-yellow-300 font-bold text-xl font-mono">dim(𝔢₈)</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-cyan-300 font-bold">rank(𝔢₈)</span>
        <span className="text-white font-bold">+</span>
        <span className="font-mono text-pink-300 font-bold">|Φ(E₈)|</span>
        <span className="text-slate-400 text-sm">= 8 + 240</span>
      </div>
    ),
    notes: [
      'Φ(E₈) is the root system containing 240 non-zero root vectors in ℝ⁸.',
    ],
  },
  {
    id: 4,
    romanNumeral: 'IV',
    title: 'Ramanujan Tau Invariant τ(3) of the Modular Discriminant',
    field: 'Arithmetic Geometry & Cusp Forms',
    rewardPulls: 100,
    expectedAnswer: '252',
    description: (
      <p className="leading-relaxed text-slate-300 text-sm">
        Consider the unique normalized cusp form of weight 12 on <span className="font-mono text-purple-300">SL₂(ℤ)</span> defined by the Dedekind eta power <span className="font-serif italic font-bold text-cyan-300">Δ(τ) = q ∏(1 − qⁿ)²⁴ = ∑ τ(n) qⁿ</span>. Evaluate <span className="font-mono font-bold text-yellow-300">τ(3)</span>:
      </p>
    ),
    equation: (
      <div className="min-w-fit flex items-center justify-center space-x-2 text-cyan-200 text-base font-serif select-none py-1">
        <span className="text-yellow-300 font-bold text-xl italic">τ(3)</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-slate-200">[q³]</span>
        <span className="text-slate-300 font-serif">q ∏<sub>n=1</sub><sup>∞</sup> (1 − qⁿ)<sup>24</sup></span>
      </div>
    ),
    notes: [
      'The expansion begins: Δ(q) = q − 24q² + 252q³ − 1472q⁴ + 4830q⁵ − ...',
    ],
  },
  {
    id: 5,
    romanNumeral: 'V',
    title: 'Kummer Congruence & 12th Bernoulli Prime Numerator',
    field: 'Algebraic Number Theory & Zeta Values',
    rewardPulls: 100,
    expectedAnswer: '691',
    description: (
      <p className="leading-relaxed text-slate-300 text-sm">
        Evaluate the irregular prime numerator of the 12th Bernoulli number <span className="font-mono text-emerald-300 font-bold">|B₁₂| = 691 / 2730</span>, which governs the Ramanujan congruence <span className="font-mono text-pink-300 font-bold">τ(n) ≡ σ₁₁(n) (mod p)</span>:
      </p>
    ),
    equation: (
      <div className="min-w-fit flex items-center justify-center space-x-2 text-cyan-200 text-base font-serif select-none py-1">
        <span className="text-yellow-300 font-bold text-xl font-mono">Numerator(|B₁₂|)</span>
        <span className="text-white font-bold">=</span>
        <span className="text-slate-200 font-mono">Numerator</span>
        <span className="text-slate-400">(</span>
        <span className="text-cyan-300 font-mono">691 / 2730</span>
        <span className="text-slate-400">)</span>
      </div>
    ),
    notes: [
      'B₁₂ satisfies ζ(12) = (−1)⁶ · (2π)¹² · B₁₂ / (2 · 12!).',
    ],
  },
  {
    id: 6,
    romanNumeral: 'VI',
    title: 'Hardy–Ramanujan Taxicab Invariant Ta(2)',
    field: 'Diophantine Geometry & Cubic Form Sums',
    rewardPulls: 100,
    expectedAnswer: '1729',
    description: (
      <p className="leading-relaxed text-slate-300 text-sm">
        Compute the smallest positive integer <span className="font-mono font-bold text-yellow-300">Ta(2)</span> expressible as the sum of two positive integer cubes in two distinct ways:
      </p>
    ),
    equation: (
      <div className="min-w-fit flex items-center justify-center space-x-2 text-cyan-200 text-base font-serif select-none py-1">
        <span className="text-yellow-300 font-bold text-xl font-mono">Ta(2)</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-pink-300">1³ + 12³</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-emerald-300">9³ + 10³</span>
      </div>
    ),
    notes: [
      '1³ + 12³ = 1 + 1728 = 1729 and 9³ + 10³ = 729 + 1000 = 1729.',
    ],
  },
  {
    id: 7,
    romanNumeral: 'VII',
    title: 'Klein Quartic Maximal Automorphism Group Order',
    field: 'Algebraic Curves & Hurwitz Automorphisms',
    rewardPulls: 100,
    expectedAnswer: '168',
    description: (
      <p className="leading-relaxed text-slate-300 text-sm">
        Let <span className="font-serif font-bold text-pink-400">X</span> be the Klein quartic projective curve <span className="font-mono text-cyan-300">x³y + y³z + z³x = 0</span> of genus <span className="font-mono text-amber-300 font-bold">g = 3</span>. Evaluate the order of its maximal automorphism group <span className="font-mono font-bold text-yellow-300">|Aut(X)|</span>:
      </p>
    ),
    equation: (
      <div className="min-w-fit flex items-center justify-center space-x-2 text-cyan-200 text-base font-serif select-none py-1">
        <span className="text-yellow-300 font-bold text-xl font-mono">|Aut(X)|</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-slate-200">84 · (g − 1)</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-pink-300">84 · 2</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-emerald-300">|PSL₂(𝔽₇)|</span>
      </div>
    ),
    notes: [
      'By Hurwitz’s automorphism theorem, 84(g − 1) is the absolute upper bound for Riemann surfaces of genus g ≥ 2.',
    ],
  },
  {
    id: 8,
    romanNumeral: 'VIII',
    title: 'Topological Euler Characteristic of the Quintic Threefold',
    field: 'Mirror Symmetry & Calabi–Yau Manifolds',
    rewardPulls: 100,
    expectedAnswer: '200',
    description: (
      <p className="leading-relaxed text-slate-300 text-sm">
        Let <span className="font-serif font-bold text-cyan-300">X ⊂ ℙ⁴(ℂ)</span> be a smooth Calabi–Yau quintic threefold with Hodge numbers <span className="font-mono text-emerald-300">h¹¹ = 1</span> and <span className="font-mono text-rose-300">h²¹ = 101</span>. Compute <span className="font-mono font-bold text-yellow-300">|χ(X)|</span>:
      </p>
    ),
    equation: (
      <div className="min-w-fit flex items-center justify-center space-x-2 text-cyan-200 text-base font-serif select-none py-1">
        <span className="text-yellow-300 font-bold text-xl font-mono">|χ(X)|</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-slate-200">|2 · (h¹¹ − h²¹)|</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-pink-300">|2 · (1 − 101)|</span>
      </div>
    ),
    notes: [
      'χ(X) = 2(1 − 101) = −200; the absolute topological Euler characteristic is 200.',
    ],
  },
  {
    id: 9,
    romanNumeral: 'IX',
    title: 'Kissing Number in 8 Dimensions & E₈ Lattice Root Count',
    field: 'Discrete Geometry & Sphere Packing',
    rewardPulls: 100,
    expectedAnswer: '240',
    description: (
      <p className="leading-relaxed text-slate-300 text-sm">
        In Euclidean space <span className="font-mono text-purple-300">ℝ⁸</span>, evaluate the maximal kissing number <span className="font-mono font-bold text-yellow-300">τ₈</span> (the maximum number of non-overlapping unit spheres touching a central unit sphere):
      </p>
    ),
    equation: (
      <div className="min-w-fit flex items-center justify-center space-x-2 text-cyan-200 text-base font-serif select-none py-1">
        <span className="text-yellow-300 font-bold text-xl font-mono">τ₈</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-emerald-300">|{'{'}v ∈ E₈ : ‖v‖² = 2{'}'}|</span>
        <span className="text-slate-400 text-sm font-mono">(Minimal norm-2 vectors of E₈)</span>
      </div>
    ),
    notes: [
      'Proved uniquely maximal by Odlyzko, Sloane, and Levenshtein.',
    ],
  },
  {
    id: 10,
    romanNumeral: 'X',
    title: 'Schubert–Katz Enumerative Lines Invariant on the Quintic Threefold',
    field: 'Enumerative Algebraic Geometry & Gromov–Witten Invariants',
    rewardPulls: 100,
    expectedAnswer: '2875',
    description: (
      <p className="leading-relaxed text-slate-300 text-sm">
        Compute the exact number of isolated complex projective lines <span className="font-mono font-bold text-yellow-300">n₁</span> (degree 1 rational curves) embedded in a generic smooth Calabi–Yau quintic threefold <span className="font-mono text-cyan-300">X ⊂ ℙ⁴</span>:
      </p>
    ),
    equation: (
      <div className="min-w-fit flex items-center justify-center space-x-2 text-cyan-200 text-base font-serif select-none py-1">
        <span className="text-yellow-300 font-bold text-xl font-mono">n₁</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-pink-300">∫<sub>Gr(2,5)</sub> c₅(Sym⁵(S*))</span>
        <span className="text-slate-400 text-sm font-mono">= 2875 lines</span>
      </div>
    ),
    notes: [
      'First computed by Hermann Schubert in 1879 and verified via modern Chern class integration over Grassmannian Gr(2,5).',
    ],
  },
  {
    id: 11,
    romanNumeral: 'XI',
    title: 'Gaussian CM Elliptic Curve j-Invariant j(i)',
    field: 'Elliptic Curves & Complex Multiplication',
    rewardPulls: 100,
    expectedAnswer: '1728',
    description: (
      <p className="leading-relaxed text-slate-300 text-sm">
        Evaluate the modular <span className="font-serif italic font-bold text-cyan-300">j</span>-invariant <span className="font-mono font-bold text-yellow-300">j(i)</span> for the elliptic curve with complex multiplication by the Gaussian integers <span className="font-mono text-purple-300">ℤ[i]</span> at <span className="font-mono text-amber-300">τ = i</span>:
      </p>
    ),
    equation: (
      <div className="min-w-fit flex items-center justify-center space-x-2 text-cyan-200 text-base font-serif select-none py-1">
        <span className="text-yellow-300 font-bold text-xl font-mono">j(i)</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-pink-300">1728 · (g₂³ / (g₂³ − 27g₃²))</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-emerald-300">12³</span>
      </div>
    ),
    notes: [
      'Because g₃(i) = 0 for the square period lattice, j(i) = 1728 exactly.',
    ],
  },
  {
    id: 12,
    romanNumeral: 'XII',
    title: 'MacMahon 3D Plane Partitions of Size 4',
    field: 'Combinatorics & Donaldson–Thomas Invariants',
    rewardPulls: 100,
    expectedAnswer: '19',
    description: (
      <p className="leading-relaxed text-slate-300 text-sm">
        Compute the number of 3-dimensional plane partitions <span className="font-mono font-bold text-yellow-300">PL(4)</span> of integer 4, generated by MacMahon’s generating function <span className="font-serif italic text-cyan-300">M(q) = ∏ (1 − qⁿ)⁻ⁿ</span>:
      </p>
    ),
    equation: (
      <div className="min-w-fit flex items-center justify-center space-x-2 text-cyan-200 text-base font-serif select-none py-1">
        <span className="text-yellow-300 font-bold text-xl font-mono">PL(4)</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-slate-200">[q⁴]</span>
        <span className="font-serif text-slate-300">∏<sub>n=1</sub><sup>∞</sup> (1 − qⁿ)<sup>−n</sup></span>
        <span className="text-slate-400 text-sm font-mono">(1 + q + 3q² + 6q³ + 19q⁴ + ...)</span>
      </div>
    ),
    notes: [
      'The plane partition counts for n = 0, 1, 2, 3, 4 are 1, 1, 3, 6, 19.',
    ],
  },
  {
    id: 13,
    romanNumeral: 'XIII',
    title: 'Topological Euler Characteristic of the K3 Surface',
    field: 'Complex Algebraic Surfaces & Differential Topology',
    rewardPulls: 100,
    expectedAnswer: '24',
    description: (
      <p className="leading-relaxed text-slate-300 text-sm">
        Evaluate the topological Euler characteristic <span className="font-mono font-bold text-yellow-300">χ(K3)</span> of any smooth complex <span className="font-serif font-bold text-pink-300">K3</span> surface with Betti numbers <span className="font-mono text-emerald-300">b₀=1, b₁=0, b₂=22, b₃=0, b₄=1</span>:
      </p>
    ),
    equation: (
      <div className="min-w-fit flex items-center justify-center space-x-2 text-cyan-200 text-base font-serif select-none py-1">
        <span className="text-yellow-300 font-bold text-xl font-mono">χ(K3)</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-pink-300">b₀ − b₁ + b₂ − b₃ + b₄</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-emerald-300">1 − 0 + 22 − 0 + 1</span>
      </div>
    ),
    notes: [
      'Also equals the second Chern number c₂(K3) by the Gauss–Bonnet–Chern theorem.',
    ],
  },
  {
    id: 14,
    romanNumeral: 'XIV',
    title: 'Kissing Number in 24 Dimensions & Leech Lattice Minimal Vectors',
    field: 'Extremal Lattices & Conway Groups',
    rewardPulls: 100,
    expectedAnswer: '196560',
    description: (
      <p className="leading-relaxed text-slate-300 text-sm">
        In Euclidean space <span className="font-mono text-purple-300">ℝ²⁴</span>, evaluate the maximal kissing number <span className="font-mono font-bold text-yellow-300">τ₂₄</span> realized by the minimal norm-4 vectors in the Leech lattice <span className="font-mono text-cyan-300">Λ₂₄</span>:
      </p>
    ),
    equation: (
      <div className="min-w-fit flex items-center justify-center space-x-2 text-cyan-200 text-base font-serif select-none py-1">
        <span className="text-yellow-300 font-bold text-xl font-mono">τ₂₄</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-pink-300">|{'{'}v ∈ Λ₂₄ : ‖v‖² = 4{'}'}|</span>
        <span className="text-slate-400 text-sm font-mono">= 196,560 minimal vectors</span>
      </div>
    ),
    notes: [
      'Proved by Cohn, Kumar, Miller, Radchenko, and Viazovska (Fields Medal 2022).',
    ],
  },
  {
    id: 15,
    romanNumeral: 'XV',
    title: 'Order of the Weyl Group of Exceptional Lie Algebra F₄',
    field: 'Coxeter Reflection Groups & Root Systems',
    rewardPulls: 100,
    expectedAnswer: '1152',
    description: (
      <p className="leading-relaxed text-slate-300 text-sm">
        Evaluate the order of the Weyl reflection group <span className="font-mono font-bold text-yellow-300">|W(F₄)|</span> for the 52-dimensional exceptional simple Lie algebra <span className="font-serif font-bold text-amber-300">𝔣₄</span>:
      </p>
    ),
    equation: (
      <div className="min-w-fit flex items-center justify-center space-x-2 text-cyan-200 text-base font-serif select-none py-1">
        <span className="text-yellow-300 font-bold text-xl font-mono">|W(F₄)|</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-pink-300">2⁷ · 3²</span>
        <span className="text-white font-bold">=</span>
        <span className="font-mono text-emerald-300">128 · 9</span>
      </div>
    ),
    notes: [
      'W(F₄) is isomorphic to the hyperoctahedral symmetry group of the 24-cell regular 4-polytope.',
    ],
  },
];

const SOLVED_STORAGE_KEY = 'osu_gacha_solved_phd_problems';

export const SecretPhDModal: React.FC<SecretPhDModalProps> = ({ isOpen, onClose }) => {
  const { refillEnergy } = useGacha();
  const [selectedProblemIndex, setSelectedProblemIndex] = useState<number>(0);
  const [answerInput, setAnswerInput] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [solvedProblemIds, setSolvedProblemIds] = useState<number[]>([]);

  // Load solved problems from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SOLVED_STORAGE_KEY);
      if (saved) {
        setSolvedProblemIds(JSON.parse(saved));
      }
    } catch {}
  }, []);

  if (!isOpen) return null;

  const currentProblem = MATH_PROBLEMS[selectedProblemIndex];
  const isCurrentSolved = solvedProblemIds.includes(currentProblem.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = answerInput.trim();

    if (clean === currentProblem.expectedAnswer) {
      sfx.playRarityReveal('Divine');
      setStatus('success');

      // Add energy reward
      await refillEnergy(currentProblem.rewardPulls);

      // Save solved state
      if (!solvedProblemIds.includes(currentProblem.id)) {
        const updated = [...solvedProblemIds, currentProblem.id];
        setSolvedProblemIds(updated);
        try {
          localStorage.setItem(SOLVED_STORAGE_KEY, JSON.stringify(updated));
        } catch {}
      }

      confetti({
        particleCount: 220,
        spread: 140,
        origin: { y: 0.6 },
        colors: ['#00d2ff', '#ff007f', '#7928ca', '#ffffff', '#ffd700', '#10b981'],
      });
    } else {
      sfx.playClick();
      setStatus('error');
      setErrorMessage(
        'Evaluation Invariant Failed: The candidate algebraic value does not satisfy the theorem spectral invariance. Re-derive the exact integer.'
      );
    }
  };

  const handleSelectProblem = (idx: number) => {
    setSelectedProblemIndex(idx);
    setAnswerInput('');
    setStatus('idle');
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-xl animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-3xl bg-[#0e0e18] border-2 border-cyan-500/50 shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-cyan-900/40 bg-slate-950/90 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <Atom className="w-6 h-6 text-cyan-400 animate-spin-slow flex-shrink-0" />
            <div>
              <h2 className="text-sm sm:text-base font-black text-white font-mono tracking-wider">
                Doctoral Qualifying Examination in Pure Mathematics
              </h2>
              <div className="flex items-center space-x-2 text-[10px] font-mono text-cyan-400">
                <span>15 Rigorous Proof Problems</span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">
                  {solvedProblemIds.length} / 15 Solved ({solvedProblemIds.length * 100 + (solvedProblemIds.includes(1) ? -50 : 0)} Pulls Claimed)
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Problem Selector Bar */}
        <div className="bg-slate-950/80 border-b border-slate-800/80 px-4 py-2 flex items-center space-x-1.5 overflow-x-auto flex-shrink-0">
          {MATH_PROBLEMS.map((prob, idx) => {
            const isSolved = solvedProblemIds.includes(prob.id);
            const isSelected = selectedProblemIndex === idx;

            return (
              <button
                key={prob.id}
                onClick={() => handleSelectProblem(idx)}
                title={`Problem ${prob.romanNumeral}: ${prob.title} (${prob.rewardPulls} Pulls)`}
                className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition-all flex items-center space-x-1 whitespace-nowrap ${
                  isSelected
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/30 scale-105'
                    : isSolved
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/60'
                    : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>{prob.romanNumeral}</span>
                {isSolved && <Check className="w-3 h-3 text-emerald-400" />}
              </button>
            );
          })}
        </div>

        {/* Modal Body Content */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-grow">
          {status !== 'success' ? (
            <>
              {/* Problem Statement Card */}
              <div className="p-5 rounded-2xl bg-slate-950/90 border border-cyan-500/30 space-y-4 text-slate-300 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 text-cyan-400 text-[11px] font-bold font-mono border-b border-cyan-900/40 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                    <span>PROBLEM {currentProblem.romanNumeral}: {currentProblem.title}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isCurrentSolved && (
                      <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>SOLVED</span>
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/50 text-amber-300 font-bold">
                      ⚡ +{currentProblem.rewardPulls} PULLS
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 font-mono">
                  <span className="text-slate-500">Subject Field: </span>
                  <span className="text-cyan-300 font-semibold">{currentProblem.field}</span>
                </div>

                {currentProblem.description}

                {/* Mathematical Equation Render */}
                <div className="p-4 sm:p-5 rounded-2xl bg-black/90 border border-slate-800 shadow-inner overflow-x-auto my-3">
                  {currentProblem.equation}
                </div>

                <div className="space-y-1 text-xs text-slate-400 pt-2 border-t border-slate-800 font-mono">
                  {currentProblem.notes.map((n, i) => (
                    <p key={i}>• {n}</p>
                  ))}
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
                  <label className="text-xs font-mono uppercase text-slate-400 font-bold flex items-center justify-between">
                    <span>Exact Integer Invariant Solution:</span>
                    <span className="text-[10px] text-cyan-400 font-mono">Reward: +{currentProblem.rewardPulls} Summon Tokens</span>
                  </label>
                  <input
                    type="text"
                    value={answerInput}
                    onChange={(e) => {
                      setAnswerInput(e.target.value);
                      if (status === 'error') setStatus('idle');
                    }}
                    placeholder={`Enter exact integer evaluation for Problem ${currentProblem.romanNumeral}...`}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-cyan-500/40 text-cyan-200 font-mono text-center text-lg tracking-widest focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    autoFocus
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.01]"
                  >
                    Submit Proof Invariant
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
                  Q.E.D. Invariant Confirmed for Problem {currentProblem.romanNumeral}!
                </h3>
                <p className="text-xs font-mono text-emerald-400">
                  {currentProblem.title} evaluated with absolute mathematical rigor.
                </p>
              </div>

              <div className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-slate-900 border border-emerald-500/40 text-emerald-300 font-mono text-sm shadow-lg">
                <Zap className="w-5 h-5 text-amber-400" />
                <span>Awarded: +{currentProblem.rewardPulls} Summon Tokens!</span>
              </div>

              <div className="pt-4 flex items-center justify-center space-x-3">
                {selectedProblemIndex + 1 < MATH_PROBLEMS.length && (
                  <button
                    onClick={() => handleSelectProblem(selectedProblemIndex + 1)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center space-x-1.5"
                  >
                    <span>Next Problem ({MATH_PROBLEMS[selectedProblemIndex + 1].romanNumeral})</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
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
