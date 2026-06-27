export default function ExternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-full bg-gray-50">
      <main className="max-w-2xl mx-auto px-4 py-10">{children}</main>
    </div>
  );
}
