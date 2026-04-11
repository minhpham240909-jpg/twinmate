export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Clerva</h1>
          <p className="text-gray-500 mt-1">Set up in under 5 minutes</p>
        </div>
        {children}
      </div>
    </div>
  )
}
