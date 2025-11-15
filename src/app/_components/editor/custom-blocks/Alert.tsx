import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { CircleCheck, CircleX, CircleAlert } from "lucide-react";

// The types of alerts that users can choose from.
export const alertTypes = [
    {
        title: "Warning",
        value: "warning",
        icon: CircleAlert
    },
    {
        title: "Error",
        value: "error",
        icon: CircleX
    },
    {
        title: "Info",
        value: "info",
        icon: CircleAlert
    },
    {
        title: "Success",
        value: "success",
        icon: CircleCheck
    },
] as const;

// The Alert block.
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
        render: (props) => {
            const alertType = alertTypes.find(
                (a) => a.value === props.block.props.type
            )!;
            const Icon = alertType.icon;
            return (
                <div contentEditable={false} className={`rounded-lg w-full p-4 ${props.block.props.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/30' :
                    props.block.props.type === 'error' ? 'bg-red-50 dark:bg-red-900/30' :
                        props.block.props.type === 'info' ? 'bg-blue-50 dark:bg-blue-900/30' :
                            'bg-green-50 dark:bg-green-900/30'}`}
                    data-alert-type={props.block.props.type}>
                    <div className="flex items-center gap-2 mb-2" contentEditable={false}>
                        <div className="flex-shrink-0">
                            <Icon
                                className={`${props.block.props.type === 'warning' ? 'text-yellow-500 dark:text-yellow-400' :
                                    props.block.props.type === 'error' ? 'text-red-500 dark:text-red-400' :
                                        props.block.props.type === 'info' ? 'text-blue-500 dark:text-blue-400' :
                                            'text-green-500 dark:text-green-400'}`}
                                data-alert-icon-type={props.block.props.type}
                                size={24}
                            />
                        </div>
                        <div contentEditable={false} className={`font-semibold ${props.block.props.type === 'warning' ? 'text-yellow-700 dark:text-yellow-200' :
                            props.block.props.type === 'error' ? 'text-red-700 dark:text-red-200' :
                                props.block.props.type === 'info' ? 'text-blue-700 dark:text-blue-200' :
                                    'text-green-700 dark:text-green-200'}`}>
                            {alertType.title}
                        </div>
                    </div>
                    <div contentEditable={false} className="prose dark:prose-invert">
                        {props.block.props.text}
                    </div>
                </div>
            );
        },
    }
);
