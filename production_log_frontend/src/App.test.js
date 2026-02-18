import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders dashboard heading", () => {
  render(<App />);
  const heading = screen.getByText(/Production Log Analysis/i);
  expect(heading).toBeInTheDocument();
});

