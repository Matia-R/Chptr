import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";

import { AlertView } from "~/app/_components/article/alert-view";

export const alertTypes = [
  { title: "Warning", value: "warning" },
  { title: "Error", value: "error" },
  { title: "Info", value: "info" },
  { title: "Success", value: "success" },
] as const;

export const Alert = createReactBlockSpec(
  {
    type: "alert",
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
      type: {
        default: "warning",
        values: ["warning", "error", "info", "success"],
      },
      text: {
        default: "",
      },
    },
    content: "inline",
  },
  {
    render: (props) => (
      <AlertView type={props.block.props.type}>{props.block.props.text}</AlertView>
    ),
  },
);
