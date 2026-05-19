import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { debateApi, DebateSession, DebateMessage } from '../api/debate';
import { DebateSetup } from '../components/debate/DebateSetup';
import { DebateSession as DebateSessionView } from '../components/debate/DebateSession';
import { Layout } from '../components/Layout';

export function DebatePage() {
  useAuth();
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<DebateSession | null>(null);
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || id === 'new') {
      setLoading(false);
      return;
    }
    debateApi.get(id).then((s) => {
      const { messages: msgs, ...sessionData } = s as DebateSession & { messages: DebateMessage[] };
      setSession(sessionData);
      setMessages(msgs ?? []);
      setLoading(false);
    });
  }, [id]);

  if (id === 'new') {
    return <Layout><DebateSetup /></Layout>;
  }

  if (loading) return <Layout><p>불러오는 중...</p></Layout>;
  if (!session) return <Layout><p>토픽을 찾을 수 없습니다.</p></Layout>;

  return (
    <Layout fullWidth>
      <DebateSessionView
        session={session}
        messages={messages}
        onSessionUpdate={setSession}
      />
    </Layout>
  );
}
