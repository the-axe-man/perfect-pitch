import LiveGameClient from "./LiveGameClient";

export default async function LiveGamePage({
  params,
}: {
  params: Promise<{ gamePk: string }>;
}) {
  const { gamePk } = await params;

  return <LiveGameClient gamePk={gamePk} />;
}
