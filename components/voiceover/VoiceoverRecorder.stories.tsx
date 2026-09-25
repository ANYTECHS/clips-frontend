import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import VoiceoverRecorder from './VoiceoverRecorder';

const meta: Meta<typeof VoiceoverRecorder> = {
  title: 'Voiceover/VoiceoverRecorder',
  component: VoiceoverRecorder,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    onSaveVoiceover: { action: 'savedVoiceover' },
    onExportMix: { action: 'exportedMix' },
  },
};

export default meta;
type Story = StoryObj<typeof VoiceoverRecorder>;

export const Default: Story = {
  args: {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    videoDuration: 30,
    onSaveVoiceover: fn(),
    onExportMix: fn(),
  },
};
