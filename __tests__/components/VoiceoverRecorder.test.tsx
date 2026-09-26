import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VoiceoverRecorder from "@/components/voiceover/VoiceoverRecorder";
import { I18nProvider } from "@/app/lib/i18n/I18nProvider";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("VoiceoverRecorder Component", () => {
  beforeEach(() => {
    // Mock getUserMedia
    const mockStream = {
      getTracks: () => [{ stop: jest.fn() }],
    };

    // Mock AudioContext
    const mockAudioContext = jest.fn().mockImplementation(() => ({
      createAnalyser: () => ({
        fftSize: 1024,
        getByteTimeDomainData: jest.fn(),
      }),
      createMediaStreamSource: () => ({
        connect: jest.fn(),
      }),
      decodeAudioData: () =>
        Promise.resolve({
          duration: 5.0,
          sampleRate: 44100,
          numberOfChannels: 1,
          getChannelData: () => new Float32Array(5 * 44100),
        }),
    }));

    // Mock MediaRecorder
    class MockMediaRecorder {
      state = "inactive";
      ondataavailable: ((e: any) => void) | null = null;
      onstop: (() => void) | null = null;
      static isTypeSupported = () => true;

      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob(["dummy_audio"], { type: "audio/webm" }) });
        }
        if (this.onstop) {
          this.onstop();
        }
      }
    }

    Object.defineProperty(global, "MediaRecorder", {
      value: MockMediaRecorder,
      writable: true,
    });

    Object.defineProperty(window, "AudioContext", {
      value: mockAudioContext,
      writable: true,
    });

    Object.assign(navigator, {
      mediaDevices: {
        getUserMedia: jest.fn().mockResolvedValue(mockStream),
        enumerateDevices: jest.fn().mockResolvedValue([
          { kind: "audioinput", deviceId: "mic-1", label: "Studio Mic" },
        ]),
      },
    });

    // Mock Canvas getContext
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
    });
  });

  it("renders the recording UI with mic input and timer", async () => {
    renderWithI18n(<VoiceoverRecorder />);

    expect(screen.getByText("Voiceover Recording")).toBeInTheDocument();
    expect(screen.getByText("Record Voiceover")).toBeInTheDocument();
    expect(screen.getByText("00:00")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Studio Mic")).toBeInTheDocument();
    });
  });

  it("starts and stops recording to generate Take 1", async () => {
    const handleSave = jest.fn();
    renderWithI18n(<VoiceoverRecorder onSaveVoiceover={handleSave} />);

    const recordBtn = screen.getByText("Record Voiceover");
    fireEvent.click(recordBtn);

    // Recording should be active
    expect(screen.getByText("Stop Recording")).toBeInTheDocument();

    const stopBtn = screen.getByText("Stop Recording");
    fireEvent.click(stopBtn);

    // Wait for decoded take to appear
    await waitFor(() => {
      expect(screen.getByText("Take 1")).toBeInTheDocument();
    });

    expect(handleSave).toHaveBeenCalled();
  });

  it("allows normalizing active take audio", async () => {
    renderWithI18n(<VoiceoverRecorder />);

    // Record a take
    fireEvent.click(screen.getByText("Record Voiceover"));
    fireEvent.click(screen.getByText("Stop Recording"));

    await waitFor(() => {
      expect(screen.getByText("Take 1")).toBeInTheDocument();
    });

    const normalizeBtn = screen.getByText("Normalize Audio (-0.1 dB Peak)");
    fireEvent.click(normalizeBtn);

    await waitFor(() => {
      expect(screen.getByText("Audio normalized successfully")).toBeInTheDocument();
    });
  });

  it("renders timeline sync offset and auto-ducking controls", async () => {
    renderWithI18n(<VoiceoverRecorder videoDuration={45} />);

    // Record a take
    fireEvent.click(screen.getByText("Record Voiceover"));
    fireEvent.click(screen.getByText("Stop Recording"));

    await waitFor(() => {
      expect(screen.getByText("Timeline Sync Offset")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Auto-duck background music during voiceover")
    ).toBeInTheDocument();
    expect(screen.getByText("Export with Mixed Audio")).toBeInTheDocument();
  });
});
