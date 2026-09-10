import QuotalisSelect,{type QuotalisOption} from './QuotalisSelect';
export default function QuotalisMultiSelect({label,value,options,onChange,minSelected=0}:{label:string;value:string[];options:QuotalisOption[];onChange:(v:string[])=>void;minSelected?:number}) {
 return <QuotalisSelect label={label} value="" options={options} onChange={()=>{}} searchable multiple={value} onMultipleChange={onChange} minSelected={minSelected}/>;
}
