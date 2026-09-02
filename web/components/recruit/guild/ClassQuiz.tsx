"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCcw } from "lucide-react";
import {
  GUILD_QUESTIONS,
  CLASS_COLORS,
  CLASS_DESCRIPTIONS,
  rollCharacter,
  type Character,
} from "@/lib/guild";
import { CLASS_ICONS, SUBCLASS_ICONS } from "./classIcons";

interface ClassQuizProps {
  character: Character | null;
  /** Fires when the fourth answer lands (with the rolled character) and on retake (null). */
  onChange: (character: Character | null) => void;
}

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Quest 1. Four questions, one per axis, shown one at a time. The fourth
 * answer triggers the reveal. Answers live in the parent's draft so a
 * refresh lands on the same question.
 */
export default function ClassQuiz({ character, onChange }: ClassQuizProps) {
  const [answers, setAnswers] = useState<number[]>(character?.answers ?? []);
  const [direction, setDirection] = useState(1);
  const qIndex = Math.min(answers.length, GUILD_QUESTIONS.length - 1);
  const revealed = !!character;

  const choose = (answerIndex: number) => {
    const next = [...answers.slice(0, qIndex), answerIndex];
    setDirection(1);
    setAnswers(next);
    if (next.length === GUILD_QUESTIONS.length) {
      onChange(rollCharacter(next));
    }
  };

  const back = () => {
    if (qIndex === 0) return;
    setDirection(-1);
    setAnswers(answers.slice(0, qIndex - 1));
  };

  const retake = () => {
    setDirection(-1);
    setAnswers([]);
    onChange(null);
  };

  if (revealed && character) {
    return <Reveal character={character} onRetake={retake} />;
  }

  const q = GUILD_QUESTIONS[qIndex];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <p className="text-sm text-[#9CA3AF]">
          Four quick questions. They shape your character card, not how your
          application is read.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-8" aria-hidden>
        {GUILD_QUESTIONS.map((question, i) => (
          <span
            key={question.id}
            className="h-1 flex-1 rounded-full transition-colors duration-300"
            style={{
              background:
                i < qIndex
                  ? "#1D9BF0"
                  : i === qIndex
                    ? "rgba(29,155,240,0.45)"
                    : "rgba(255,255,255,0.08)",
            }}
          />
        ))}
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={q.id}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -40 : 40 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
          >
            <p className="text-xs text-[#6B7280] mb-2">
              Question {qIndex + 1} of {GUILD_QUESTIONS.length}
            </p>
            <h3 className="text-xl md:text-2xl font-semibold text-[#F1FFFF] mb-6 leading-snug">
              {q.text}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {q.answers.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => choose(i)}
                  className="text-left p-4 rounded-2xl border transition-all duration-150 bg-white/[0.03] border-white/10 hover:border-[#1D9BF0]/60 hover:bg-[#1D9BF0]/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9BF0]/60 active:scale-[0.99]"
                >
                  <span className="text-sm text-[#E5E7EB] leading-relaxed">
                    {a.text}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 h-5">
        {qIndex > 0 && (
          <button
            type="button"
            onClick={back}
            className="flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-[#F1FFFF] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous question
          </button>
        )}
      </div>
    </div>
  );
}

function Reveal({
  character,
  onRetake,
}: {
  character: Character;
  onRetake: () => void;
}) {
  const color = CLASS_COLORS[character.class];
  const ClassIcon = CLASS_ICONS[character.class];
  const SubIcon = SUBCLASS_ICONS[character.subclass] ?? ClassIcon;

  return (
    <div className="py-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          className="relative w-24 h-24 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: `${color}14`,
            border: `2px solid ${color}`,
            boxShadow: `0 0 40px ${color}33`,
          }}
        >
          <ClassIcon className="w-10 h-10" style={{ color }} />
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 18 }}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center bg-[#0F0F10]"
            style={{ border: `1px solid ${color}66` }}
          >
            <SubIcon className="w-4 h-4" style={{ color }} />
          </motion.span>
        </motion.div>

        <div className="min-w-0">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xs text-[#6B7280] mb-1"
          >
            Your character
          </motion.p>
          <motion.h3
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: EASE_OUT }}
            className="text-3xl md:text-4xl font-semibold tracking-tight leading-none mb-2"
            style={{ color }}
          >
            {character.class}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5, ease: EASE_OUT }}
            className="text-base text-[#F1FFFF] mb-3"
          >
            {character.subclass}
            <span
              className="ml-2 text-xs"
              style={{ color: "#6B7280", fontFamily: "var(--font-highlight)" }}
            >
              {character.mbti}
            </span>
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.5 }}
            className="text-sm text-[#9CA3AF] leading-relaxed max-w-[44ch]"
          >
            {CLASS_DESCRIPTIONS[character.class]}
          </motion.p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-8 flex items-center gap-4"
      >
        <button
          type="button"
          onClick={onRetake}
          className="flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-[#F1FFFF] transition"
        >
          <RotateCcw className="w-4 h-4" />
          Roll again
        </button>
        <span className="text-xs text-[#6B7280]">
          Happy with it? Continue to the next quest.
        </span>
      </motion.div>
    </div>
  );
}
