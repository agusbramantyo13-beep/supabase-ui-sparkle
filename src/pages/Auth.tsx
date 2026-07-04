import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LogIn, UserPlus, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get("next");
  const isSafeNext = (n: string | null): n is string =>
    !!n && n.startsWith("/") && !n.startsWith("//");
  const redirectAfterAuth = () => {
    if (isSafeNext(nextParam)) {
      window.location.href = nextParam;
    } else {
      navigate("/");
    }
  };
  const { toast } = useToast();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      } else if (event === "SIGNED_IN" && !isRecovery) {
        redirectAfterAuth();
      }
    });

    // Check existing session but don't redirect if hash contains recovery
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    if (params.get("type") === "recovery") {
      setIsRecovery(true);
      return;
    }

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !isRecovery) {
        redirectAfterAuth();
      }
    };
    checkUser();

    return () => subscription.unsubscribe();
  }, [navigate, isRecovery]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Berhasil masuk!",
      });

      redirectAfterAuth();
    } catch (error: any) {
      toast({
        title: "Gagal",
        description: error.message || "Gagal masuk",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Periksa email Anda untuk tautan konfirmasi!",
      });
    } catch (error: any) {
      toast({
        title: "Gagal",
        description: error.message || "Gagal mendaftar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async () => {
    const targetEmail = (resetEmail || email).trim();

    if (!targetEmail) {
      toast({
        title: "Gagal",
        description: "Masukkan email terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }

    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;

      toast({
        title: "Terkirim",
        description: "Link reset password sudah dikirim. Cek Inbox/Spam.",
      });
    } catch (error: any) {
      toast({
        title: "Gagal",
        description: error.message || "Gagal mengirim link reset",
        variant: "destructive",
      });
    } finally {
      setSendingReset(false);
    }
  };

  const updatePasswordFromRecovery = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recoveryPassword || recoveryPassword.length < 6) {
      toast({
        title: "Gagal",
        description: "Kata sandi minimal 6 karakter.",
        variant: "destructive",
      });
      return;
    }

    if (recoveryPassword !== recoveryPasswordConfirm) {
      toast({
        title: "Gagal",
        description: "Konfirmasi kata sandi tidak sama.",
        variant: "destructive",
      });
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: recoveryPassword,
      });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Kata sandi berhasil diperbarui. Silakan lanjut masuk.",
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Gagal",
        description: error.message || "Gagal memperbarui kata sandi",
        variant: "destructive",
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const pageTitle = isRecovery ? "Atur Ulang Kata Sandi" : "Selamat Datang di Sistem POS";
  const pageSubtitle = isRecovery
    ? "Masukkan kata sandi baru untuk akun Anda"
    : "Masuk ke akun Anda atau buat akun baru";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">{pageTitle}</h1>
          <p className="text-muted-foreground">{pageSubtitle}</p>
        </div>

        <Card className="bg-gradient-card">
          <CardContent className="p-6">
            {isRecovery ? (
              <>
                <CardHeader className="px-0">
                  <CardTitle className="text-xl text-center text-foreground flex items-center justify-center gap-2">
                    <Lock className="w-5 h-5" />
                    Atur Ulang Kata Sandi
                  </CardTitle>
                </CardHeader>

                <form onSubmit={updatePasswordFromRecovery} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="recovery-password">Kata Sandi Baru</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        id="recovery-password"
                        type={showRecoveryPassword ? "text" : "password"}
                        placeholder="Masukkan kata sandi baru"
                        value={recoveryPassword}
                        onChange={(e) => setRecoveryPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showRecoveryPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground">Kata sandi minimal 6 karakter</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recovery-password-confirm">Konfirmasi Kata Sandi Baru</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        id="recovery-password-confirm"
                        type={showRecoveryPassword ? "text" : "password"}
                        placeholder="Ulangi kata sandi baru"
                        value={recoveryPasswordConfirm}
                        onChange={(e) => setRecoveryPasswordConfirm(e.target.value)}
                        className="pl-10"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-primary hover:bg-primary/90"
                    disabled={updatingPassword}
                  >
                    {updatingPassword ? "Menyimpan..." : "Simpan Kata Sandi"}
                  </Button>
                </form>
              </>
            ) : (
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Masuk</TabsTrigger>
                  <TabsTrigger value="signup">Daftar</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="space-y-4">
                  <CardHeader className="px-0">
                    <CardTitle className="text-xl text-center text-foreground flex items-center justify-center gap-2">
                      <LogIn className="w-5 h-5" />
                      Masuk
                    </CardTitle>
                  </CardHeader>

                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="Masukkan email Anda"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Kata Sandi</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          id="signin-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Masukkan kata sandi Anda"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="-mt-2">
                      <button
                        type="button"
                        className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
                        onClick={() => {
                          setForgotOpen((v) => !v);
                          if (!resetEmail) setResetEmail(email);
                        }}
                      >
                        Lupa kata sandi?
                      </button>
                    </div>

                    {forgotOpen && (
                      <div className="rounded-md border border-border/50 bg-background/40 p-4 space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="reset-email">Email untuk reset</Label>
                          <Input
                            id="reset-email"
                            type="email"
                            placeholder="user@example.com"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            required
                          />
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={sendPasswordReset}
                          disabled={sendingReset}
                        >
                          {sendingReset ? "Mengirim..." : "Kirim link reset"}
                        </Button>

                        <p className="text-xs text-muted-foreground">
                          Kami akan mengirim link untuk membuat kata sandi baru ke email tersebut.
                        </p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-gradient-primary hover:bg-primary/90"
                      disabled={loading}
                    >
                      {loading ? "Memproses..." : "Masuk"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="space-y-4">
                  <CardHeader className="px-0">
                    <CardTitle className="text-xl text-center text-foreground flex items-center justify-center gap-2">
                      <UserPlus className="w-5 h-5" />
                      Buat Akun
                    </CardTitle>
                  </CardHeader>

                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Nama Lengkap</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Masukkan nama lengkap Anda"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="Masukkan email Anda"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Kata Sandi</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Buat kata sandi"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground">Kata sandi minimal 6 karakter</p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-gradient-primary hover:bg-primary/90"
                      disabled={loading}
                    >
                      {loading ? "Membuat Akun..." : "Buat Akun"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Dengan masuk, Anda menyetujui Syarat Layanan dan Kebijakan Privasi kami
          </p>
        </div>
      </div>
    </div>
  );
}
