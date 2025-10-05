import { useState, useRef, useEffect } from "react";
import { Camera, UserCheck, Clock, LogOut as CheckOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AttendanceRecord {
  id: string;
  check_in_time: string;
  check_out_time: string | null;
  selfie_url: string | null;
  notes: string | null;
}

export default function Attendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    fetchTodayAttendance();
    fetchRecentAttendance();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const fetchTodayAttendance = async () => {
    if (!user) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .gte('check_in_time', today.toISOString())
      .maybeSingle();

    if (error) {
      console.error('Error fetching today attendance:', error);
      return;
    }

    setTodayAttendance(data);
  };

  const fetchRecentAttendance = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .order('check_in_time', { ascending: false })
      .limit(7);

    if (error) {
      console.error('Error fetching recent attendance:', error);
      return;
    }

    setRecentAttendance(data || []);
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' },
        audio: false 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      setStream(mediaStream);
      setCameraActive(true);
      setCapturedImage(null);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageData);
        stopCamera();
      }
    }
  };

  const uploadSelfie = async (base64Image: string): Promise<string | null> => {
    if (!user) return null;

    try {
      // Convert base64 to blob
      const response = await fetch(base64Image);
      const blob = await response.blob();
      
      // Create unique filename
      const fileName = `${user.id}/${Date.now()}.jpg`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('attendance-selfies')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('attendance-selfies')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading selfie:', error);
      return null;
    }
  };

  const handleCheckIn = async () => {
    if (!capturedImage || !user) {
      toast({
        title: "Error",
        description: "Please capture a selfie first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Upload selfie
      const selfieUrl = await uploadSelfie(capturedImage);
      
      if (!selfieUrl) {
        throw new Error('Failed to upload selfie');
      }

      // Insert attendance record
      const { error } = await supabase
        .from('attendance')
        .insert({
          user_id: user.id,
          selfie_url: selfieUrl,
          notes: notes.trim() || null,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Check-in recorded successfully!",
      });

      // Reset form
      setCapturedImage(null);
      setNotes("");
      
      // Refresh data
      await fetchTodayAttendance();
      await fetchRecentAttendance();
    } catch (error) {
      console.error('Error checking in:', error);
      toast({
        title: "Error",
        description: "Failed to record check-in",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayAttendance || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('attendance')
        .update({ check_out_time: new Date().toISOString() })
        .eq('id', todayAttendance.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Check-out recorded successfully!",
      });

      await fetchTodayAttendance();
      await fetchRecentAttendance();
    } catch (error) {
      console.error('Error checking out:', error);
      toast({
        title: "Error",
        description: "Failed to record check-out",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Attendance</h1>
        <p className="text-muted-foreground">Record your attendance with selfie</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera Section */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Take Selfie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              {cameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Captured selfie"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Camera className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="flex gap-2">
              {!cameraActive && !capturedImage && (
                <Button onClick={startCamera} className="flex-1">
                  <Camera className="w-4 h-4 mr-2" />
                  Start Camera
                </Button>
              )}
              
              {cameraActive && (
                <>
                  <Button onClick={capturePhoto} className="flex-1">
                    <Camera className="w-4 h-4 mr-2" />
                    Capture
                  </Button>
                  <Button onClick={stopCamera} variant="outline">
                    Cancel
                  </Button>
                </>
              )}
              
              {capturedImage && (
                <Button onClick={() => {
                  setCapturedImage(null);
                  startCamera();
                }} variant="outline" className="flex-1">
                  Retake
                </Button>
              )}
            </div>

            {capturedImage && (
              <>
                <Textarea
                  placeholder="Add notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />

                <Button
                  onClick={handleCheckIn}
                  disabled={loading || !!todayAttendance}
                  className="w-full"
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  {loading ? 'Processing...' : 'Check In'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Today's Status */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Today's Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayAttendance ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <span className="text-sm text-muted-foreground">Check In</span>
                    <span className="font-semibold text-foreground">
                      {format(new Date(todayAttendance.check_in_time), 'HH:mm')}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <span className="text-sm text-muted-foreground">Check Out</span>
                    <span className="font-semibold text-foreground">
                      {todayAttendance.check_out_time 
                        ? format(new Date(todayAttendance.check_out_time), 'HH:mm')
                        : '-'}
                    </span>
                  </div>

                  {todayAttendance.notes && (
                    <div className="p-3 bg-muted/20 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Notes</p>
                      <p className="text-foreground">{todayAttendance.notes}</p>
                    </div>
                  )}
                </div>

                {!todayAttendance.check_out_time && (
                  <Button
                    onClick={handleCheckOut}
                    disabled={loading}
                    variant="outline"
                    className="w-full"
                  >
                    <CheckOut className="w-4 h-4 mr-2" />
                    Check Out
                  </Button>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No check-in recorded today</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Attendance */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground">Recent Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAttendance.length > 0 ? (
            <div className="rounded-md border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Check In</TableHead>
                    <TableHead className="text-muted-foreground">Check Out</TableHead>
                    <TableHead className="text-muted-foreground">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentAttendance.map((record) => (
                    <TableRow key={record.id} className="border-border/50">
                      <TableCell className="font-medium text-foreground">
                        {format(new Date(record.check_in_time), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {format(new Date(record.check_in_time), 'HH:mm')}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {record.check_out_time 
                          ? format(new Date(record.check_out_time), 'HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {record.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <UserCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No attendance records yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
