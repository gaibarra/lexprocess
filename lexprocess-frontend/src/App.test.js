import { render, screen } from '@testing-library/react';
import App from './App';

test('render login page by default', async () => {
  render(<App />);
  expect(await screen.findByText(/Iniciar Sesión/i)).toBeInTheDocument();
});
