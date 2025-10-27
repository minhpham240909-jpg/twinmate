/**
 * AI Agent Demo Page
 * Test all AI components in one place
 */

'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAIAgent } from '@/components/providers/AIAgentProvider'
import {
  QuizCard,
  MatchInsightPanel,
  StudyPlanView,
  FlashcardReview,
  DocumentUpload,
} from '@/components/ai-agent'
import { Sparkles, FileText, Brain, Users, Calendar, Zap } from 'lucide-react'

type DemoSection = 'upload' | 'quiz' | 'flashcards' | 'plan' | 'match' | 'chat'

export default function AIDemoPage() {
  const [activeSection, setActiveSection] = useState<DemoSection>('chat')
  const { openPanel } = useAIAgent()

  const sections = [
    { id: 'chat' as DemoSection, name: 'AI Chat', icon: Sparkles, color: 'blue' },
    { id: 'upload' as DemoSection, name: 'Upload Docs', icon: FileText, color: 'green' },
    { id: 'quiz' as DemoSection, name: 'Quiz', icon: Brain, color: 'purple' },
    { id: 'flashcards' as DemoSection, name: 'Flashcards', icon: Zap, color: 'yellow' },
    { id: 'plan' as DemoSection, name: 'Study Plan', icon: Calendar, color: 'indigo' },
    { id: 'match' as DemoSection, name: 'Match Insight', icon: Users, color: 'pink' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4"
          >
            <Sparkles className="w-4 h-4" />
            AI Agent Demo
          </motion.div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Clerva AI Agent System
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Test all AI-powered features including chat, document upload, quiz generation,
            flashcard review, study planning, and partner matching.
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {sections.map((section) => {
            const Icon = section.icon
            const isActive = activeSection === section.id
            return (
              <button
                key={section.id}
                onClick={() => {
                  if (section.id === 'chat') {
                    openPanel()
                  } else {
                    setActiveSection(section.id)
                  }
                }}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                  isActive
                    ? `bg-${section.color}-600 text-white shadow-lg scale-105`
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                {section.name}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-4xl mx-auto"
        >
          {activeSection === 'chat' && (
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-12 text-center">
              <Sparkles className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-3">AI Chat Assistant</h2>
              <p className="text-slate-600 mb-6">
                Click the button below to open the AI chat panel and try commands like:
              </p>
              <div className="bg-slate-50 rounded-xl p-4 text-left text-sm text-slate-700 mb-6 space-y-2">
                <p>• "Generate a 5-question quiz on calculus"</p>
                <p>• "Create a 4-week study plan for AP Physics"</p>
                <p>• "Find study partners who are online now"</p>
                <p>• "Search my notes for algebra equations"</p>
              </div>
              <button
                onClick={() => openPanel()}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                Open AI Chat Panel
              </button>
            </div>
          )}

          {activeSection === 'upload' && (
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Document Upload</h2>
              <p className="text-slate-600 mb-6">
                Upload documents to add them to your RAG knowledge base. Supported formats: TXT, MD, PDF, JSON, DOCX
              </p>
              <DocumentUpload onUploadComplete={(docId) => console.log('Uploaded:', docId)} />
            </div>
          )}

          {activeSection === 'quiz' && (
            <QuizCard
              quizId="demo-quiz"
              title="Sample Calculus Quiz"
              items={[
                {
                  q: "What is the derivative of x²?",
                  choices: ["2x", "x", "2x²", "x²/2"],
                  answer: "2x",
                  explanation: "Using the power rule: d/dx(x^n) = nx^(n-1), so d/dx(x²) = 2x",
                },
                {
                  q: "What is the integral of 1/x?",
                  choices: ["ln(x) + C", "1/x² + C", "x² + C", "-1/x² + C"],
                  answer: "ln(x) + C",
                  explanation: "The antiderivative of 1/x is the natural logarithm: ∫(1/x)dx = ln|x| + C",
                },
                {
                  q: "What is the limit of sin(x)/x as x approaches 0?",
                  choices: ["1", "0", "∞", "Does not exist"],
                  answer: "1",
                  explanation: "This is a fundamental limit: lim(x→0) sin(x)/x = 1",
                },
              ]}
              onComplete={(score, answers) => console.log('Quiz complete:', score, answers)}
            />
          )}

          {activeSection === 'flashcards' && (
            <FlashcardReview onComplete={(reviewed, correct) => console.log('Reviewed:', reviewed, correct)} />
          )}

          {activeSection === 'plan' && (
            <StudyPlanView
              planId="demo-plan"
              title="4-Week AP Physics Study Plan"
              weekBlocks={[
                {
                  week: 1,
                  focus: "Mechanics Fundamentals",
                  tasks: [
                    { title: "Review Newton's Laws", etaMin: 60, completed: true },
                    { title: "Practice kinematics problems", etaMin: 90, completed: true },
                    { title: "Complete Chapter 1 exercises", etaMin: 120, completed: false },
                  ],
                },
                {
                  week: 2,
                  focus: "Energy and Momentum",
                  tasks: [
                    { title: "Study work-energy theorem", etaMin: 45, completed: false },
                    { title: "Solve momentum conservation problems", etaMin: 90, completed: false },
                    { title: "Watch lecture videos", etaMin: 60, completed: false, link: "https://youtube.com" },
                  ],
                },
                {
                  week: 3,
                  focus: "Rotational Motion",
                  tasks: [
                    { title: "Learn angular kinematics", etaMin: 60, completed: false },
                    { title: "Practice torque problems", etaMin: 75, completed: false },
                  ],
                },
                {
                  week: 4,
                  focus: "Review and Practice Tests",
                  tasks: [
                    { title: "Complete practice exam 1", etaMin: 120, completed: false },
                    { title: "Review weak areas", etaMin: 90, completed: false },
                    { title: "Final practice test", etaMin: 120, completed: false },
                  ],
                },
              ]}
              onTaskToggle={(week, task) => console.log('Toggled:', week, task)}
            />
          )}

          {activeSection === 'match' && (
            <MatchInsightPanel
              candidateName="Alex Johnson"
              compatibilityScore={0.82}
              complementarySkills={[
                "Alex excels in calculus and can help with your weak areas in derivatives",
                "You're strong in physics mechanics which complements Alex's interest in learning it",
                "Both prefer visual learning styles with diagrams and videos",
              ]}
              risks={[
                "Different grade levels (you: 11th, Alex: 10th) may cause slight curriculum mismatch",
                "Your available hours have only 2 overlapping windows per week",
              ]}
              jointStudyPlan={[
                "Week 1-2: You teach physics mechanics, Alex teaches calculus derivatives",
                "Week 3-4: Collaborative problem-solving sessions on applied physics with calculus",
                "Use visual study materials and create diagrams together",
              ]}
              canStudyNow={true}
              nextBestTimes={[
                { whenISO: new Date(Date.now() + 86400000).toISOString(), confidence: 0.9 },
                { whenISO: new Date(Date.now() + 172800000).toISOString(), confidence: 0.85 },
                { whenISO: new Date(Date.now() + 259200000).toISOString(), confidence: 0.8 },
              ]}
              onStartNow={() => alert('Starting session with Alex!')}
              onScheduleLater={(time) => alert(`Scheduled for ${new Date(time).toLocaleString()}`)}
            />
          )}
        </motion.div>
      </div>
    </div>
  )
}
