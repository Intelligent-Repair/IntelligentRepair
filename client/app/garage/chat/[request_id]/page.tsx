export default function GarageChatPage({ params }: { params: { request_id: string } }) {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">צ'אט מוסך ←→ לקוח</h1>
        <p className="text-gray-600">בקשה מספר: {params.request_id}</p>
      </div>
    </div>
  );
}

