import {render,screen} from "@testing-library/react";
import {expect,it} from "vitest";
import {PreviewLocaleProvider} from "../../i18n/LocaleProvider";
import NotificationPreview from "./NotificationPreview";
it("explains the same threshold in used and remaining terms without sending a notification",()=>{
  const {container}=render(<PreviewLocaleProvider><NotificationPreview high={80} critical={90} enabled={false}/></PreviewLocaleProvider>);
  expect(screen.getByText("Notification Preview Title")).toBeInTheDocument();
  expect(screen.getByText("80% Detail Cost Used · 20% Detail Cost Remaining")).toBeInTheDocument();
  expect(screen.getByText("90% Detail Cost Used · 10% Detail Cost Remaining")).toBeInTheDocument();
  expect(screen.getByText("Notification Center Paused")).toBeInTheDocument();
  expect(screen.getByRole("progressbar",{name:"High Usage Alert"})).toHaveAttribute("aria-valuenow","80");
  expect(container.querySelector(".notification-overview__provider-icon")).not.toBeNull();
  expect(screen.getByRole("img", {name: "Quotalis"})).toHaveAttribute(
    "data-quotaarc-mark",
    "official",
  );
});
