import type { Meta, StoryObj } from '@storybook/react';
import { AuthForm } from './AuthForm';

const meta: Meta<typeof AuthForm> = {
  title: 'Auth/AuthForm',
  component: AuthForm,
  tags: ['autodocs'],
  argTypes: {
    onSubmit: { action: 'submitted' },
  },
};

export default meta;
type Story = StoryObj<typeof AuthForm>;

export const Login: Story = {
  args: {
    mode: 'login',
    isLoading: false,
  },
};

export const Register: Story = {
  args: {
    mode: 'register',
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    mode: 'login',
    isLoading: true,
  },
};

export const ErrorState: Story = {
  args: {
    mode: 'login',
    isLoading: false,
    errorMessage: 'Invalid credentials. Please try again.',
  },
};
